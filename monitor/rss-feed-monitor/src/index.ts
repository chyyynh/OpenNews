import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram, tagNews, scrapeArticleContent } from './utils';
import { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { GoogleGenAI } from '@google/genai';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	GEMINI_API_KEY: string;
}

async function notifyMatchedUsers(supabase: any, env: Env, tags: Array<string>, content: string) {
	const { data: users, error } = await supabase.from('user_preferences').select('telegram_id, selected_tags');

	if (error) {
		console.error('[notifyMatchedUsers] 無法取得用戶資料', error);
		return;
	}

	const matchedUsers = users.filter(
		(user: { telegram_id: string; selected_tags: string[] }) =>
			// 空陣列 → 接收全部
			user.selected_tags.length === 0 ||
			// 否則比對 tag
			user.selected_tags.some((tag: string) => tags.includes(tag))
	);

	console.log(`[notifyMatchedUsers] 符合條件的用戶數量：${matchedUsers.length}`);
	const formattedTags = tags.map((tag) => `#${tag}`).join(' ');

	for (const user of matchedUsers) {
		await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, user.telegram_id?.toString(), `${formattedTags}\n\n${content}`, {
			parse_mode: 'Markdown',
		});

		console.log(`[Telegram Notify] Send to ${user.telegram_id}, tags ${JSON.stringify(user.selected_tags)}`);
	}
}

async function processAndInsertArticle(supabase: any, env: Env, item: any, feed?: any, source_type?: string) {
	console.log(`[${feed.name}] Starting processAndInsertArticle for: ${item.title || item.text || 'No title'}`);

	// Handle different date formats (RSS vs Atom)
	const pubDate = item.pubDate || item.isoDate || item.published || item.updated || null;
	// Handle different link formats (RSS vs Atom vs arXiv)
	let url;
	if (feed.name && feed.name.toLowerCase().includes('arxiv')) {
		// arXiv feeds have special link handling
		if (item.id) {
			// arXiv ID format: http://arxiv.org/abs/2401.12345v1
			url = item.id;
		} else if (typeof item.link === 'string') {
			url = item.link; // arXiv link is direct string
		} else if (item.link && Array.isArray(item.link)) {
			// arXiv can have multiple links, find the abs link
			const absLink = item.link.find((l: any) => l['@_href']?.includes('/abs/'));
			url = absLink ? absLink['@_href'] : item.link[0]['@_href'];
		} else if (item.link?.['@_href']) {
			url = item.link['@_href'];
		}
	} else if (typeof item.link === 'string') {
		url = item.link;
	} else if (item.link?.['@_href']) {
		// Atom feed with XML attributes
		url = item.link['@_href'];
	} else if (item.link?.href) {
		// Standard href property
		url = item.link.href;
	} else if (item.url) {
		url = item.url;
	} else {
		url = `https://t.me/${feed.RSSLink}/${item.message_id}`;
	}

	// Scrape article content if it's an RSS feed item with a link
	let crawled_content = '';
	if (source_type === 'rss' && url && typeof url === 'string') {
		try {
			crawled_content = await scrapeArticleContent(url);
		} catch (scrapeError) {
			console.warn(`[${feed.name}] Content scraping failed for ${url}, continuing with RSS data only`);
			crawled_content = '';
		}
	}

	console.log(`[${feed.name}] Preparing insert data...`);

	// For arXiv feeds, extract detailed information and store in content field
	let summary = null;
	let contentExtensions = '';
	
	if (feed.name && feed.name.toLowerCase().includes('arxiv')) {
		summary = item.description || item.summary || null;
		
		// Extract authors from arXiv feed and add to content
		if (item.author) {
			let authors = '';
			if (Array.isArray(item.author)) {
				authors = item.author.map((a: any) => a.name || a).join(', ');
			} else if (typeof item.author === 'object' && item.author.name) {
				authors = item.author.name;
			} else if (typeof item.author === 'string') {
				authors = item.author;
			}
			if (authors) {
				contentExtensions += `\n\nAuthors: ${authors}`;
			}
		}
		
		// Extract arXiv categories and add to content
		if (item.category) {
			let arxiv_categories = '';
			if (Array.isArray(item.category)) {
				arxiv_categories = item.category.map((c: any) => c['@_term'] || c).join(', ');
			} else if (typeof item.category === 'object' && item.category['@_term']) {
				arxiv_categories = item.category['@_term'];
			} else if (typeof item.category === 'string') {
				arxiv_categories = item.category;
			}
			if (arxiv_categories) {
				contentExtensions += `\n\nArXiv Categories: ${arxiv_categories}`;
			}
		}
	}

	const insert = {
		url: url,
		title: item.title || item.text || item.news_title || 'No Title',
		source: feed.name || item.source_name || 'Unknown',
		published_date: pubDate ? new Date(pubDate) : new Date(),
		scraped_date: new Date(),
		keywords: [], // Empty array for now, will be filled by separate cronjob
		tags: [], // Empty array for now, will be filled by separate cronjob
		tokens: [], // Empty array for now, will be filled by separate cronjob
		summary: '', // For arXiv: use description, others: null (filled by separate cronjob)
		source_type: source_type || 'rss',
		content: (summary || crawled_content || '') + contentExtensions,
	};

	console.log(`[${feed.name}] Inserting article into database...`);
	const { error: insertError } = await supabase.from('articles').insert([insert]);

	if (insertError) {
		console.error(`[${feed.name}] Insert error:`, insertError);
	} else {
		console.log(`[${feed.name}] ✅ Inserted article: ${item.title || item.text} (${url})`);
	}
}

const CommentByAI = async (title: string, summary: string, apiKey: string) => {
	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: 'gemini-1.5-flash',
		contents: `你是加密領域的銳評關鍵意見領袖, 請用 "1-3 句話" 使用 "繁體中文" 盡可能簡潔的評論這則新聞: ${title} ${summary}`,
	});
	const text = response.text ?? '';
	return text;
};

const SummaryByAI = async (title: string, article: string, apiKey: string) => {
	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: 'gemini-1.5-flash',
		contents: `幫我用繁體中文 1-2 句話總結這篇新聞 \n\n ${title} \n\n ${article}`,
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

					// Check for rate limiting (429) or other HTTP errors
					if (!res.ok) {
						if (res.status === 429) {
							console.warn(`[${feed.name}] Rate limited (429), skipping this round`);
							return;
						} else {
							console.error(`[${feed.name}] HTTP error: ${res.status} ${res.statusText}`);
							return;
						}
					}

					const xml = await res.text();
					const data = parser.parse(xml);
					
					// Enhanced logging for feed structure
					console.log(`[${feed.name}] Parsing XML feed...`);
					if (data?.rss?.channel) {
						const channel = data.rss.channel;
						console.log(`[${feed.name}] RSS channel found: ${channel.title || 'No title'}`);
						console.log(`[${feed.name}] Items found: ${channel.item ? (Array.isArray(channel.item) ? channel.item.length : 1) : 0}`);
					} else if (data?.feed) {
						console.log(`[${feed.name}] Atom feed found: ${data.feed.title || 'No title'}`);
						console.log(`[${feed.name}] Entries found: ${data.feed.entry ? (Array.isArray(data.feed.entry) ? data.feed.entry.length : 1) : 0}`);
					} else if (data?.['rdf:RDF']) {
						const rdf = data['rdf:RDF'];
						console.log(`[${feed.name}] RDF feed found: ${rdf.channel?.title || 'No title'}`);
						console.log(`[${feed.name}] Items found: ${rdf.item ? (Array.isArray(rdf.item) ? rdf.item.length : 1) : 0}`);
					}

					// Support multiple feed formats: RSS, Atom, RDF, etc.
					let items;
					if (data?.rss?.channel?.item) {
						// Standard RSS format
						items = data.rss.channel.item;
					} else if (data?.feed?.entry) {
						// Atom format
						items = data.feed.entry;
					} else if (data?.channel?.item) {
						// Alternative RSS format
						items = data.channel.item;
					} else if (data?.['rdf:RDF']?.item) {
						// RDF/RSS 1.0 format
						items = data['rdf:RDF'].item;
					} else if (data?.rss?.channel) {
						// RSS channel exists but no items - this is normal, not an error
						console.log(`[${feed.name}] RSS channel found but no items available at this time`);
						items = [];
					} else if (data?.['rdf:RDF']?.channel) {
						// RDF channel exists but no items - this is normal, not an error
						console.log(`[${feed.name}] RDF channel found but no items available at this time`);
						items = [];
					} else {
						console.error(`[${feed.name}] Invalid format - no recognized feed structure found`);
						console.log(`[${feed.name}] Feed structure:`, JSON.stringify(data, null, 2).substring(0, 500) + '...');
						return;
					}

					// Handle case where items might not be an array (single item) or might be empty
					if (!items) {
						console.log(`[${feed.name}] No items found in feed`);
						items = [];
					} else if (!Array.isArray(items)) {
						// Single item case - convert to array
						items = [items];
					}
					
					if (items.length === 0) {
						console.log(`[${feed.name}] No items to process`);
						// Still update the scraped_at timestamp even if no items
						await supabase
							.from('RssList')
							.update({
								scraped_at: new Date(),
								url: feed.url,
							})
							.eq('id', feed.id);
						return;
					}

					// Set different limits based on feed type
					if (feed.name && feed.name.toLowerCase().includes('anthropic')) {
						// Anthropic feeds are ordered oldest to newest, so take the last 30
						if (items.length > 30) {
							console.log(`[${feed.name}] Feed has ${items.length} items, limiting to last 30 (newest)`);
							items = items.slice(-30);
						}
					} else if (feed.name && !feed.name.toLowerCase().includes('arxiv')) {
						// Only limit non-arXiv feeds to 30 items for frequent polling
						if (items.length > 30) {
							console.log(`[${feed.name}] Feed has ${items.length} items, limiting to first 30`);
							items = items.slice(0, 30);
						}
					} else if (feed.name && feed.name.toLowerCase().includes('arxiv')) {
						console.log(`[${feed.name}] arXiv feed: processing all ${items.length} items`);
					}

					const urls = items
						.map((item: any) => {
							// Handle arXiv feeds specially
							if (feed.name && feed.name.toLowerCase().includes('arxiv')) {
								if (item.id) {
									return item.id; // arXiv ID format
								} else if (typeof item.link === 'string') {
									return item.link; // arXiv link is direct string
								} else if (item.link && Array.isArray(item.link)) {
									const absLink = item.link.find((l: any) => l['@_href']?.includes('/abs/'));
									return absLink ? absLink['@_href'] : item.link[0]['@_href'];
								}
							}
							
							if (typeof item.link === 'string') {
								return item.link;
							} else if (item.link?.['@_href']) {
								return item.link['@_href'];
							} else if (item.link?.href) {
								return item.link.href;
							} else if (item.url) {
								return item.url;
							}
							return null;
						})
						.filter(Boolean);

					// Split URLs into batches to avoid 414 Request-URI Too Large error
					const BATCH_SIZE = 50;
					let existing: any[] = [];

					for (let i = 0; i < urls.length; i += BATCH_SIZE) {
						const batch = urls.slice(i, i + BATCH_SIZE);
						const { data: batchExisting, error: fetchError } = await supabase.from('articles').select('url').in('url', batch);

						if (fetchError) {
							console.error(`[${feed.name}] Fetch error in batch ${i / BATCH_SIZE + 1}:`, fetchError);
							return;
						}

						if (batchExisting) {
							existing.push(...batchExisting);
						}
					}

					const existingUrls = new Set(existing.map((e: any) => e.url));
					
					const newItems = items.filter((item: any) => {
						let itemUrl;
						
						// Handle arXiv feeds specially
						if (feed.name && feed.name.toLowerCase().includes('arxiv')) {
							if (item.id) {
								itemUrl = item.id; // arXiv ID format
							} else if (typeof item.link === 'string') {
								itemUrl = item.link; // arXiv link is direct string
							} else if (item.link && Array.isArray(item.link)) {
								const absLink = item.link.find((l: any) => l['@_href']?.includes('/abs/'));
								itemUrl = absLink ? absLink['@_href'] : item.link[0]['@_href'];
							}
						} else if (typeof item.link === 'string') {
							itemUrl = item.link;
						} else if (item.link?.['@_href']) {
							itemUrl = item.link['@_href'];
						} else if (item.link?.href) {
							itemUrl = item.link.href;
						} else if (item.url) {
							itemUrl = item.url;
						}
						
						return itemUrl && !existingUrls.has(itemUrl);
					});

					console.log(`[${feed.name}] Found ${newItems.length} new items to process`);
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
