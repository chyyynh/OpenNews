import { sendMessageToTelegram } from './utils';
import { createClient } from '@supabase/supabase-js';

interface Env {
	KAITO_API_KEY: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

interface Tweet {
	id?: string;
	url: string;
	createdAt: string;
	viewCount: number;
	author: {
		id?: string;
		userName: string;
		name: string;
		verified?: boolean;
	};
	text: string;
	likeCount?: number;
	retweetCount?: number;
	replyCount?: number;
	quoteCount?: number;
	media?: any[];
	hashTags?: string[];
	mentions?: any[];
	urls?: any[];
	lang?: string;
	possiblySensitive?: boolean;
	source?: string;
	listType?: string;
}

interface ApiResponse {
	status: string;
	message?: string;
	tweets?: Tweet[];
	has_next_page?: boolean;
	next_cursor?: string;
}

interface TelegramUpdate {
	message?: {
		text?: string;
		from: { id: number };
		chat: { id: number };
	};
}

async function getLastQueryTime(listId: string, supabase: any): Promise<Date | null> {
	try {
		const { data, error } = await supabase
			.from('dtnews_tweets')
			.select('scraped_at')
			.eq('list_id', listId)
			.order('scraped_at', { ascending: false })
			.limit(1)
			.single();

		if (error && error.code !== 'PGRST116') {
			console.error('Error getting last query time:', error);
			return null;
		}

		return data ? new Date(data.scraped_at) : null;
	} catch (error) {
		console.error('Error in getLastQueryTime:', error);
		return null;
	}
}

async function saveTweetToSupabase(tweet: Tweet, listId: string, listType: string, supabase: any): Promise<void> {
	try {
		const tweetData = {
			tweet_id: tweet.id,
			text: tweet.text,
			created_at: tweet.createdAt,
			author_id: tweet.author?.id,
			author_username: tweet.author?.userName,
			author_name: tweet.author?.name,
			author_verified: tweet.author?.verified || false,
			view_count: tweet.viewCount || 0,
			like_count: tweet.likeCount || 0,
			retweet_count: tweet.retweetCount || 0,
			reply_count: tweet.replyCount || 0,
			quote_count: tweet.quoteCount || 0,
			tweet_url: tweet.url,
			media_urls: tweet.media?.map((m) => m.url) || [],
			list_type: listType,
			list_id: listId,
			hashtags: tweet.hashTags || [],
			mentions: tweet.mentions?.map((m) => m.username) || [],
			urls: tweet.urls?.map((u) => u.expanded_url || u.url) || [],
			lang: tweet.lang,
			possibly_sensitive: tweet.possiblySensitive || false,
			source: tweet.source,
		};

		const { error } = await supabase
			.from('dtnews_tweets')
			.upsert(tweetData, { 
				onConflict: 'tweet_id',
				ignoeDuplicates: true 
			});

		if (error) {
			console.error('Error saving tweet to Supabase:', error);
		} else {
			console.log('Tweet saved successfully:', tweet.id);
		}
	} catch (error) {
		console.error('Error in saveTweetToSupabase:', error);
	}
}

async function getHighViewTweetsFromList(apiKey: string, listId: string, listType: string, supabase: any): Promise<Tweet[]> {
	const allFilteredTweets: Tweet[] = [];
	let cursor: string | null = null;
	let hasNextPage = true;

	const apiEndpoint = 'https://api.twitterapi.io/twitter/list/tweets';
	const viewThreshold = 10000;

	const headers = {
		'X-API-Key': apiKey,
		'Content-Type': 'application/json',
	};

	// 獲取上次查詢時間，如果沒有則使用 24 小時前
	const lastQueryTime = await getLastQueryTime(listId, supabase);
	const now = new Date();
	let sinceTime: Date;

	if (lastQueryTime) {
		// 如果有上次查詢時間，從那時開始查詢（減去 1 小時緩衝）
		sinceTime = new Date(lastQueryTime.getTime() - 60 * 60 * 1000); // 減去 1 小時緩衝
		console.log(`Using last query time: ${lastQueryTime.toISOString()}, querying since: ${sinceTime.toISOString()}`);
	} else {
		// 如果沒有上次查詢記錄，查詢過去 24 小時
		sinceTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		console.log(`No previous query found, querying past 24 hours since: ${sinceTime.toISOString()}`);
	}

	const sinceTimeUnix = Math.floor(sinceTime.getTime() / 1000);

	console.log(
		`Starting query for ${listType} list ID '${listId}'. Searching for tweets since ${sinceTime.toISOString()} (Unix: ${sinceTimeUnix}) with view count > ${viewThreshold}...`
	);

	while (hasNextPage) {
		const params = new URLSearchParams({
			listId: listId,
			sinceTime: sinceTimeUnix.toString(),
			includeReplies: 'false',
			limit: '20',
		});

		if (cursor) {
			params.append('cursor', cursor);
		}

		try {
			const response = await fetch(`${apiEndpoint}?${params}`, {
				method: 'GET',
				headers,
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`HTTP error: ${response.status}. Response: ${errorText}`);
				break;
			}

			const data: ApiResponse = await response.json();

			if (data.status !== 'success') {
				console.error(`API returned error status: ${data.status}. Message: ${data.message || 'Unknown error'}`);
				break;
			}

			if (data.tweets && data.tweets.length > 0) {
				let currentPageFilteredCount = 0;
				for (const tweet of data.tweets) {
					if (tweet.viewCount > viewThreshold) {
						// 只保存高瀏覽量推文到 Supabase
						await saveTweetToSupabase(tweet, listId, listType, supabase);
						tweet.listType = listType;
						allFilteredTweets.push(tweet);
						currentPageFilteredCount++;
					}
				}

				console.log(`Current page retrieved ${data.tweets.length} tweets, ${currentPageFilteredCount} meet view count criteria.`);

				hasNextPage = data.has_next_page || false;
				cursor = data.next_cursor || null;

				if (hasNextPage) {
					console.log('Next page exists, continuing...');
				} else {
					console.log('Reached last page or no more tweets.');
				}
			} else {
				console.log('No tweets retrieved on current page.');
				hasNextPage = false;
			}

			// Rate limiting - wait 1 second between requests
			if (hasNextPage) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		} catch (error) {
			console.error(`Error during API request:`, error);
			break;
		}
	}

	return allFilteredTweets;
}

async function getAllHighViewTweets(apiKey: string, supabase: any): Promise<{ coreTweets: Tweet[]; applicationTweets: Tweet[] }> {
	const coreListId = '1894659296388157547'; // AI Core list
	const applicationListId = '1920007527703662678'; // AI Application list

	const [coreTweets, applicationTweets] = await Promise.all([
		getHighViewTweetsFromList(apiKey, coreListId, 'Core', supabase),
		getHighViewTweetsFromList(apiKey, applicationListId, 'Application', supabase),
	]);

	return { coreTweets, applicationTweets };
}

async function handleTelegramMessage(update: TelegramUpdate, env: Env): Promise<void> {
	if (!update.message?.text) return;

	const messageText = update.message.text.toLowerCase();
	const chatId = update.message.chat.id.toString();

	// 檢查是否為查詢熱門 AI 訊息的指令
	if (messageText.includes('熱門') || messageText.includes('ai') || messageText.includes('查詢') || messageText === '/hot') {
		await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, chatId, '正在查詢熱門 AI 推文，請稍候...');

		try {
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
			const { coreTweets, applicationTweets } = await getAllHighViewTweets(env.KAITO_API_KEY, supabase);

			if (coreTweets.length > 0 || applicationTweets.length > 0) {
				let message = `發現 ${coreTweets.length + applicationTweets.length} 則高瀏覽量推文\n\n`;

				if (coreTweets.length > 0) {
					message += `Core\n`;
					for (let i = 0; i < coreTweets.length; i++) {
						const tweet = coreTweets[i];
						message += `${i + 1}. @${tweet.author?.userName || 'N/A'} - ${tweet.viewCount.toLocaleString()} 瀏覽\n`;
						message += `   ${tweet.url || 'N/A'}\n`;
					}
					message += `\n`;
				}

				if (applicationTweets.length > 0) {
					message += `Application\n`;
					for (let i = 0; i < applicationTweets.length; i++) {
						const tweet = applicationTweets[i];
						message += `${i + 1}. @${tweet.author?.userName || 'N/A'} - ${tweet.viewCount.toLocaleString()} 瀏覽\n`;
						message += `   ${tweet.url || 'N/A'}\n`;
					}
				}

				await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, chatId, message);
			} else {
				await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, chatId, '過去24小時內沒有發現瀏覽量超過10,000的推文');
			}
		} catch (error) {
			console.error('Error in telegram message handler:', error);
			await sendMessageToTelegram(
				env.TELEGRAM_BOT_TOKEN,
				chatId,
				`查詢過程中發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	} else {
		// 回應使用說明
		await sendMessageToTelegram(
			env.TELEGRAM_BOT_TOKEN,
			chatId,
			'發送包含 "熱門"、"AI" 或 "查詢" 的訊息，或使用 /hot 指令來查詢熱門 AI 推文'
		);
	}
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
			const { coreTweets, applicationTweets } = await getAllHighViewTweets(env.KAITO_API_KEY, supabase);

			if (coreTweets.length > 0 || applicationTweets.length > 0) {
				console.log(
					`\n--- Successfully found ${
						coreTweets.length + applicationTweets.length
					} tweets in the past 24 hours with view count > 10,000 ---`
				);

				let message = `發現 ${coreTweets.length + applicationTweets.length} 則高瀏覽量推文\n\n`;

				if (coreTweets.length > 0) {
					message += `Core\n`;
					for (let i = 0; i < coreTweets.length; i++) {
						const tweet = coreTweets[i];
						message += `${i + 1}. @${tweet.author?.userName || 'N/A'} - ${tweet.viewCount.toLocaleString()} 瀏覽\n`;
						message += `   ${tweet.url || 'N/A'}\n`;
					}
					message += `\n`;
				}

				if (applicationTweets.length > 0) {
					message += `Application\n`;
					for (let i = 0; i < applicationTweets.length; i++) {
						const tweet = applicationTweets[i];
						message += `${i + 1}. @${tweet.author?.userName || 'N/A'} - ${tweet.viewCount.toLocaleString()} 瀏覽\n`;
						message += `   ${tweet.url || 'N/A'}\n`;
					}
				}

				await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);
			} else {
				console.log('\nNo tweets found in the past 24 hours with view count > 10,000.');
				await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, '過去24小時內沒有發現瀏覽量超過10,000的推文');
			}
		} catch (error) {
			console.error('Error in scheduled job:', error);
			await sendMessageToTelegram(
				env.TELEGRAM_BOT_TOKEN,
				env.TELEGRAM_CHAT_ID,
				`監控過程中發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			// 處理 Telegram webhook
			if (request.method === 'POST') {
				const update: TelegramUpdate = await request.json();
				await handleTelegramMessage(update, env);
				return new Response('OK');
			}

			// 處理 GET 請求 - 手動查詢
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
			const { coreTweets, applicationTweets } = await getAllHighViewTweets(env.KAITO_API_KEY, supabase);
			return new Response(
				JSON.stringify({
					success: true,
					coreCount: coreTweets.length,
					applicationCount: applicationTweets.length,
					coreTweets: coreTweets,
					applicationTweets: applicationTweets,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		} catch (error) {
			return new Response(
				JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	},
};
