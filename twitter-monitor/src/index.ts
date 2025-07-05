import { sendMessageToTelegram } from './utils';

interface Env {
	KAITO_API_KEY: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

interface Tweet {
	url: string;
	createdAt: string;
	viewCount: number;
	author: {
		userName: string;
		name: string;
	};
	text: string;
}

interface ApiResponse {
	status: string;
	message?: string;
	tweets?: Tweet[];
	has_next_page?: boolean;
	next_cursor?: string;
}

async function getHighViewTweets(apiKey: string): Promise<Tweet[]> {
	const allFilteredTweets: Tweet[] = [];
	let cursor: string | null = null;
	let hasNextPage = true;

	const listId = '1920007527703662678'; // AI Application list
	const apiEndpoint = 'https://api.twitterapi.io/twitter/list/tweets';
	const viewThreshold = 10000;

	const headers = {
		'X-API-Key': apiKey,
		'Content-Type': 'application/json',
	};

	// Calculate 24 hours ago timestamp
	const now = new Date();
	const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const sinceTimeUnix = Math.floor(twentyFourHoursAgo.getTime() / 1000);

	console.log(
		`Starting query for list ID '${listId}'. Searching for tweets since ${twentyFourHoursAgo.toISOString()} (Unix: ${sinceTimeUnix}) with view count > ${viewThreshold}...`
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

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			const tweets = await getHighViewTweets(env.KAITO_API_KEY);

			if (tweets.length > 0) {
				console.log(`\n--- Successfully found ${tweets.length} tweets in the past 24 hours with view count > 10,000 ---`);

				let message = `發現 ${tweets.length} 則高瀏覽量推文\n\n`;

				for (let i = 0; i < tweets.length; i++) {
					const tweet = tweets[i];
					message += `推文 ${i + 1}:\n`;
					message += `作者: @${tweet.author?.userName || 'N/A'}\n`;
					message += `瀏覽量: ${tweet.viewCount.toLocaleString()}\n`;
					message += `時間: ${tweet.createdAt || 'N/A'}\n`;
					message += `連結: ${tweet.url || 'N/A'}\n\n`;
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
				`❌ 監控過程中發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const tweets = await getHighViewTweets(env.KAITO_API_KEY);
			return new Response(
				JSON.stringify({
					success: true,
					count: tweets.length,
					tweets: tweets,
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
