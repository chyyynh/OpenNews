import keyword_extractor from 'keyword-extractor';
import * as cheerio from 'cheerio';

export async function sendMessageToTelegram(token: string, chatId: string, message: string) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body = JSON.stringify({
		chat_id: chatId,
		text: message,
	});

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body,
		});

		if (!response.ok) {
			console.error('Error sending message to Telegram:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('Error sending message to Telegram:', error);
	}
}

export function tagNews(title: string): string[] {
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
		const response = await fetch(url);
		if (!response.ok) {
			console.error(`[Scraper] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
			return '';
		}
		const html = await response.text();
		const $ = cheerio.load(html);

		// Try common selectors for main article content
		let content = '';
		const selectors = ['article', '.article-content', '.post-content', '.entry-content', 'main', '#content', '#main', '.main-content'];

		for (const selector of selectors) {
			content = $(selector).text().trim();
			if (content) {
				break; // Found content, stop searching
			}
		}

		// Basic cleanup (remove excessive whitespace)
		if (content) {
			content = content.replace(/\s\s+/g, ' ').trim();
		}

		console.log(`[Scraper] Scraped content from ${url} (length: ${content.length})`);
		return content;
	} catch (error) {
		console.error(`[Scraper] Error scraping ${url}:`, error);
		return '';
	}
}
