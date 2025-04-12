import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram, tagNews, scrapeArticleContent } from './utils';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { GoogleGenAI } from '@google/genai';
import { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	TELEGRAM_API_ID: string;
	TELEGRAM_API_HASH: string;
	TELEGRAM_SESSION: string;
	GEMINI_API_KEY: string;
}

const CommentByAI = async (title: string, summary: string, apiKey: string) => {
	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: 'gemini-1.5-flash',
		contents: `你是穿越時空的炒幣 degen 孫子兵法裡的孫武, 請用最多兩段文字盡可能簡潔的評論這則新聞: ${title} ${summary}`,
	});
	const text = response.text ?? '';
	return text;
};

interface TelegramResponse {
	ok: boolean;
	result: any[];
	description?: string;
}

async function processAndInsertArticle(supabase: any, env: Env, item: any, feed: any, source_type: string) {
	const pubDate = item.pubDate || item.isoDate || null;
	const summary = item.description || item['content:encoded'] || item.text || '';
	const categories = item.category ? (Array.isArray(item.category) ? item.category : [item.category]) : [];
	const tags = tagNews(item.title || item.text);
	const url = item.link || `https://t.me/${feed.RSSLink}/${item.message_id}`;

	// Scrape article content if it's an RSS feed item with a link
	let crawled_content = '';
	if (source_type === 'rss' && item.link) {
		crawled_content = await scrapeArticleContent(item.link);
	}

	const insert = {
		url: url,
		title: item.title || item.text,
		source: feed.name,
		published_date: pubDate ? new Date(pubDate) : null,
		scraped_date: new Date(),
		categories,
		tags: tags,
		summary,
		source_type: source_type,
		crawled_content: crawled_content, // Add crawled content
	};

	const { error: insertError } = await supabase.from('articles').insert([insert]);

	if (insertError) {
		console.error(`[${feed.name}] Insert error:`, insertError);
	} else {
		const aiCommentary = await CommentByAI(item.title || item.text, summary, env.GEMINI_API_KEY);
		await sendMessageToTelegram(
			env.TELEGRAM_BOT_TOKEN,
			env.TELEGRAM_CHAT_ID,
			`${aiCommentary}\n${feed.name}:${item.title || item.text}\n\n${url}`
		);
		console.log(`[${feed.name}] New article: ${item.title || item.text} tags ${JSON.stringify(tags)}`);
	}
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const parser = new XMLParser({ ignoreAttributes: false });
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// Fetch all feeds from the RssList table, including the type
		const { data: RSSList, error: fetchRssListError } = await supabase.from('RssList').select('id, name, RSSLink, url, type');

		console.log('Fetched RSS feeds:', RSSList);

		if (fetchRssListError) {
			console.error('Error fetching RSS feeds from RssList:', fetchRssListError);
			return;
		}

		// Loop through each feed in the RssList table
		for (const feed of RSSList) {
			console.log(`Processing feed: ${feed.name} (${feed.RSSLink}) type:${feed.type}`);
			try {
				if (feed.type === 'rss') {
					const res = await fetch(feed.RSSLink);
					const xml = await res.text();
					const data = parser.parse(xml);

					const items = data?.rss?.channel?.item;
					if (!items || !Array.isArray(items)) {
						console.error(`[${feed.name}] Invalid format`);
						continue;
					}

					const urls = items.map((item: any) => item.link);
					const { data: existing, error: fetchError } = await supabase.from('articles').select('url').in('url', urls);

					if (fetchError) {
						console.error(`[${feed.name}] Fetch error`, fetchError);
						continue;
					}

					const existingUrls = new Set(existing.map((e: any) => e.url));
					const newItems = items.filter((item: any) => !existingUrls.has(item.link));

					for (const item of newItems) {
						await processAndInsertArticle(supabase, env, item, feed, 'rss');
					}

					// Update the RssList table with the latest scrape time and RSSLink
					const { error: updateError } = await supabase
						.from('RssList')
						.update({
							scraped_at: new Date(),
							url: feed.url, // Store the URL as the processed link
						})
						.eq('id', feed.id);

					if (updateError) {
						console.error(`[${feed.name}] Failed to update RssList:`, updateError);
					} else {
						console.log(`[${feed.name}] Updated RssList table`);
					}
				} else if (feed.type === 'telegram') {
					// should edit this part to cloudflare queue, check https://developers.cloudflare.com/queues/
					/*
					const start = performance.now();
					const apiId = parseInt(env.TELEGRAM_API_ID);
					const apiHash = env.TELEGRAM_API_HASH;
					const sessionString = env.TELEGRAM_SESSION;

					const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 5 });

					try {
						await client.connect();
						// 從 url 欄位獲取 last_message_id，若無則設為 0
						const lastMessageId = feed.url ? parseInt(feed.url) || 0 : 0;
						// 獲取比 lastMessageId 更新的訊息
						const messages = await client.getMessages(feed.RSSLink, {
							limit: 5, // 設置一個合理上限
							minId: lastMessageId, // 只獲取比上次記錄更新的訊息
						});

						if (messages.length === 0) {
							console.log(`[${feed.name}] No new messages since last check (last_message_id: ${lastMessageId})`);
						}

						let latestMessageId = lastMessageId;
						for (const msg of messages) {
							if (msg.text) {
								const telegramItem = {
									message_id: msg.id,
									text: msg.text,
									pubDate: new Date(msg.date * 1000).toISOString(),
								};
								await processAndInsertArticle(supabase, env, telegramItem, feed, 'telegram');
								// 更新最新訊息 ID
								latestMessageId = Math.max(latestMessageId, msg.id);
							}
						}

						// 更新 RssList 表中的 url（作為 last_message_id）和 scraped_at
						const { error: updateError } = await supabase
							.from('RssList')
							.update({
								scraped_at: new Date(),
								url: latestMessageId.toString(), // 將整數轉為字串存入 url
							})
							.eq('id', feed.id);

						if (updateError) {
							console.error(`[${feed.name}] Failed to update RssList:`, updateError);
						} else {
							console.log(`[${feed.name}] Updated RssList table with last_message_id: ${latestMessageId}`);
						}
						const duration = performance.now() - start;
						console.log(`[${feed.name}] Telegram 處理時間: ${duration.toFixed(2)}ms`);
					} catch (telegramError) {
						console.error(`[${feed.name}] Telegram error:`, telegramError);
					} finally {
						await client.disconnect();
					}
					*/
				}
			} catch (err) {
				console.error(`[${feed.name}] Failed to process`, err);
			}
		}
	},
};
