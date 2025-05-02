import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram, tagNews, scrapeArticleContent } from './utils';
import { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { GoogleGenAI } from '@google/genai';

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

async function processAndInsertArticle(supabase: any, env: Env, item: any, feed?: any, source_type?: string) {
	const pubDate = item.pubDate || item.isoDate || null;
	const summary = item.description || item['content:encoded'] || item.text || '';
	const categories = item.category ? (Array.isArray(item.category) ? item.category : [item.category]) : [];
	const tags = await tagNews(item.title || item.text || item.news_title);
	const url = item.link || item.url || `https://t.me/${feed.RSSLink}/${item.message_id}`;

	// Scrape article content if it's an RSS feed item with a link
	let crawled_content = '';
	if (source_type === 'rss' && item.link) {
		crawled_content = await scrapeArticleContent(item.link);
	}

	const ai_summary = await SummaryByAI(item.title || item.text, crawled_content, env.GEMINI_API_KEY);

	const insert = {
		url: url,
		title: item.title || item.text || item.news_title || 'No Title',
		source: feed.name || item.source_name || 'Unknown',
		published_date: new Date(pubDate) || new Date(),
		scraped_date: new Date(),
		categories,
		tags: item.coins_included || tags,
		summary: ai_summary,
		source_type: source_type || `websocket`,
		content: crawled_content,
	};

	const { error: insertError } = await supabase.from('articles').insert([insert]);

	if (insertError) {
		console.error(`[${feed.name}] Insert error:`, insertError);
	} else {
		const aiCommentary = await CommentByAI(item.title || item.text, summary, env.GEMINI_API_KEY);
		await sendMessageToTelegram(
			env.TELEGRAM_BOT_TOKEN,
			env.TELEGRAM_CHAT_ID,
			`${aiCommentary}\n${feed.name}:${item.title || item.text || item.news_title}\n\n${ai_summary}\n\n${url}`
		);
		console.log(`[${feed.name}] New article: ${item.title || item.text} tags ${JSON.stringify(tags)}`);
	}
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

const SummaryByAI = async (title: string, article: string, apiKey: string) => {
	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: 'gemini-1.5-flash',
		contents: `幫我用繁體中文 1-3 句話總結這篇新聞 \n\n ${title} \n\n ${article}`,
	});
	const text = response.text ?? '';
	return text;
};

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const parser = new XMLParser({ ignoreAttributes: false });
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// Fetch all feeds from the RssList table, including the type
		const { data: RSSList, error: fetchRssListError } = await supabase.from('RssList').select('id, name, RSSLink, url, type');

		if (fetchRssListError) {
			console.error('Error fetching RSS feeds from RssList:', fetchRssListError);
			return;
		} else {
			console.log('Fetched RSS feeds:', RSSList);
		}

		const feedTasks = RSSList.map(async (feed) => {
			try {
				console.log(`Processing feed: ${feed.name}`);
				if (feed.type === 'rss') {
					const res = await fetch(feed.RSSLink);
					const xml = await res.text();
					const data = parser.parse(xml);

					const items = data?.rss?.channel?.item;
					if (!items || !Array.isArray(items)) {
						console.error(`[${feed.name}] Invalid format`);
						return;
					}

					const urls = items.map((item: any) => item.link);
					const { data: existing, error: fetchError } = await supabase.from('articles').select('url').in('url', urls);

					if (fetchError) {
						console.error(`[${feed.name}] Fetch error`, fetchError);
						return;
					}

					const existingUrls = new Set(existing.map((e: any) => e.url));
					const newItems = items.filter((item: any) => !existingUrls.has(item.link));

					await Promise.allSettled(newItems.map((item: any) => processAndInsertArticle(supabase, env, item, feed, 'rss')));

					await supabase
						.from('RssList')
						.update({
							scraped_at: new Date(),
							url: feed.url,
						})
						.eq('id', feed.id);

					console.log(`[${feed.name}] Done.`);
				}
				// 其他 feed.type 處理略
			} catch (err) {
				console.error(`[${feed.name}] Failed to process`, err);
			}
		});

		await Promise.allSettled(feedTasks);
	},
	// Webhook 端點 這裡的 fetch 方法會處理來自 WebSocket 客戶端的請求
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/webhook' && request.method === 'POST') {
			console.log('Webhook request received');

			//可選：安全檢查 - 驗證 Secret
			/* 
            if (env.WEBHOOK_SECRET) {
                const incomingSecret = request.headers.get('X-Webhook-Secret'); // 或其他 header
                if (incomingSecret !== env.WEBHOOK_SECRET) {
                    console.warn("Webhook authentication failed: Invalid secret.");
                    return new Response('Unauthorized', { status: 401 });
                }
            }
			*/

			try {
				// 解析請求 body 中的 JSON 數據
				const message: any = await request.json(); // 假設 WS Client 發送的是 JSON

				// 驗證消息內容 (基本檢查)
				if (!message || typeof message !== 'object') {
					console.warn('Webhook received invalid data format.');
					return new Response('Bad Request: Invalid JSON payload', { status: 400 });
				}

				console.log('Webhook payload parsed:', message);

				// 初始化 Supabase Client 在高並發下，每次請求都創建客戶端可能效率不高，但對於 Worker 來說是標準做法
				const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

				// 使用 ctx.waitUntil 允許數據庫插入和後續處理在響應發送後進行 這樣可以快速響應 Webhook 調用者
				ctx.waitUntil(
					processAndInsertArticle(supabase, env, message, {
						name: message.source_name || 'WebSocket Source', // 嘗試從消息中獲取來源名稱
						type: 'websocket', // 指定來源類型
						link: message.url || 'WebSocket Source', // 如果消息中有 link 字段，可以傳遞
					})
				);

				// 立即返回成功響應給 Webhook 調用者 (Node.js client) 202 Accepted 表示請求已被接受處理，但不保證處理已完成
				return new Response(JSON.stringify({ status: 'received', message: 'Message queued for processing.' }), {
					status: 202,
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error: any) {
				if (error instanceof SyntaxError) {
					// JSON 解析錯誤
					console.error('Webhook JSON parsing error:', error);
					return new Response('Bad Request: Could not parse JSON.', { status: 400 });
				}
				// 其他處理錯誤
				console.error('Webhook processing error:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		}
		// --- 對於未匹配的路由返回 404 ---
		console.log(`Request not found: ${request.method} ${url.pathname}`);
		return new Response('Not Found', { status: 404 });
	},
};
