import keyword_extractor from 'keyword-extractor';
import * as axios from 'axios';
import * as cheerio from 'cheerio';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

interface TelegramResponse {
	ok: boolean;
	result: any[];
	description?: string;
}

export async function sendMessageToTelegram(token: string, chatId: string, message: string, options?: Record<string, any>) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;

	const body: any = {
		chat_id: chatId,
		text: message,
		...options,
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			console.error('Error sending message to Telegram:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('Error sending message to Telegram:', error);
	}
}

export async function tagNews(title: string): Promise<string[]> {
	const text = title.toLowerCase();
	const tags = new Set<string>(); // Use Set to avoid duplicate tags

	// 1. Extract keywords using keyword-extractor
	const extraction_result = keyword_extractor.extract(text, {
		language: 'english',
		remove_digits: true,
		return_changed_case: true,
		remove_duplicates: true,
	});

	// 2. Tokenize the title using natural for more granular checks if needed
	// const tokenizer = new WordTokenizer();
	// const tokens = tokenizer.tokenize(text);
	// For now, keyword_extractor seems sufficient, but keeping tokenizer logic commented for potential future use.

	const keywords = extraction_result; // Use keywords extracted by keyword-extractor

	// 3. Define tag categories and their associated keywords
	const categoryKeywords: { [key: string]: string[] } = {
		listing: ['listing', 'launch', 'listed'],
		hack: ['hack', 'hacked', 'security', 'breach', 'exploit', 'vulnerability', 'stolen', 'theft'],
		regulation: ['regulation', 'sec', 'cftc', 'ban', 'compliance', 'enforcement', 'lawsuit', 'legal', `regulator`],
		partnership: ['partnership', 'collaboration', 'partner', 'integrate', 'join forces'],
		funding: ['funding', 'raise', 'investment', 'seed', 'series'],
		airdrop: ['airdrop'],
		nft: ['nft', 'non-fungible', 'collectible'],
		defi: ['defi', 'decentralized finance'],
		stablecoin: ['stablecoin', 'usdc', 'usdt', 'dai'],
		metaverse: ['metaverse'],
		trump: ['trump', 'donald trump'],
	};

	const coinKeywords: { [key: string]: string[] } = {
		BTC: ['btc', 'bitcoin'],
		ETH: ['eth', 'ethereum'],
		XRP: ['xrp', 'ripple'],
		SOL: ['sol', 'solana'],
		ADA: ['ada', 'cardano'],
		DOT: ['dot', 'polkadot'],
		DOGE: ['doge', 'dogecoin'],
		SHIB: ['shib', 'shiba inu'],
		BNB: ['bnb', 'binance coin'],
		LTC: ['ltc', 'litecoin'],
		LINK: ['link', 'chainlink'],
		MATIC: ['matic', 'polygon'],
		AVAX: ['avax', 'avalanche'],
	};

	// 4. Tag based on keywords
	keywords.forEach((keyword: string) => {
		// Check categories
		for (const category in categoryKeywords) {
			if (categoryKeywords[category].includes(keyword)) {
				tags.add(category);
			}
		}
		// Check coins
		for (const coin in coinKeywords) {
			if (coinKeywords[coin].includes(keyword)) {
				tags.add(coin);
			}
		}
	});

	// 5. Fallback: Check original text if no keywords matched specific tags (optional, can be removed if keyword extraction is reliable enough)
	// This helps catch cases where the keyword extractor might miss something obvious
	const checkOriginalText = (tagMap: { [key: string]: string[] }) => {
		for (const tag in tagMap) {
			if (tagMap[tag].some((kw) => text.includes(kw))) {
				tags.add(tag);
			}
		}
	};

	if (tags.size === 0) {
		// Only run fallback if no tags were found via keywords
		checkOriginalText(categoryKeywords);
		checkOriginalText(coinKeywords);
	}

	// Add a generic 'crypto' tag if no other specific tags are found?
	// if (tags.size === 0 && (text.includes('crypto') || text.includes('blockchain'))) {
	//     tags.add('crypto');
	// }

	return Array.from(tags);
}

export async function scrapeArticleContent(url: string): Promise<string> {
	try {
		// Add a User-Agent header to mimic a browser request
		console.log(`[Scraper] Scraping content from ${url}...`);
		const headers = {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
		};
		const response = await axios.default.get(url, { headers });
		const html = response.data;
		const $ = cheerio.load(html);
		let content = ''; // for accumulating content
		const title = $('title').text();
		content += `# ${title}\n\n`; // Add title to content
		const elements = $('p, img, a, h1, h2, h3'); // Select relevant elements including h2, h3
		const errors: string[] = []; // Array to collect errors during element processing

		for (const el of elements) {
			try {
				const element = $(el); // Wrap the element with cheerio object
				if (element.is('p')) {
					content += element.text().trim() + '\n\n'; // Accumulate paragraph text
				} else if (element.is('h1')) {
					content += `## ${element.text().trim()}\n\n`;
				} else if (element.is('h2')) {
					content += `### ${element.text().trim()}\n\n`;
				} else if (element.is('h3')) {
					content += `#### ${element.text().trim()}\n\n`;
				} else if (element.is('img')) {
					// Filter out unwanted images based on class
					if (
						!element.hasClass('social-image') &&
						!element.hasClass('navbar-logo') &&
						!element.hasClass('_1sjywpl0 bc5nci19k bc5nci4t0 bc5nci4ow') // mirror pfp class
					) {
						let imgSrc = element.attr('src');

						// Handle relative image URLs
						if (imgSrc && !imgSrc.startsWith('http')) {
							try {
								imgSrc = new URL(imgSrc, url).href; // Convert relative to absolute URL
							} catch (urlError: any) {
								errors.push(`Invalid image URL found: ${imgSrc} - ${urlError.message}`);
								imgSrc = undefined; // Skip invalid URLs
							}
						}

						if (imgSrc) {
							content += `![Image](${imgSrc})\n\n`; // Add image in Markdown format
						}
					}
				}
				// Note: 'a' tags are selected but not explicitly processed, they are ignored.
			} catch (elementError: any) {
				// Catch errors during processing of a single element
				errors.push(`Error processing element: ${elementError.message}`);
				// Optionally log the specific element causing trouble: console.error("Problem element:", $.html(el));
			}
		}

		// Log any collected errors after the loop
		if (errors.length > 0) {
			console.warn(`[Scraper] Encountered ${errors.length} errors while processing elements for ${url}:`);
			errors.forEach((err) => console.warn(` - ${err}`));
		}

		console.log(`[Scraper] Scraped content from ${url} (length: ${content.length})`);
		return content.trim(); // Trim final whitespace
	} catch (error) {
		console.error(`[Scraper] Error scraping ${url}:`, error);
		return '';
	}
}

// Telegram 監控
/*
export async function monitorTgMsg(feed: string) {
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
}
	*/
