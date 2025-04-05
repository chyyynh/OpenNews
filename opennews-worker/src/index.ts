import { ScheduledEvent, ExecutionContext, Request } from '@cloudflare/workers-types'; // Added Request
import { XMLParser } from 'fast-xml-parser';

// Define the Env interface based on expected bindings in wrangler.toml
interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

const RSS_FEED_URL = 'https://cointelegraph.com/rss'; // Added https:// protocol

export default {
	// Add a basic fetch handler for wrangler dev compatibility
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('OpenNews Worker - Scheduled task handler only.', { status: 200 });
	},

	// Use _event to indicate it's unused, add types for all params
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('\n\nScheduled function triggered...\n\n');

		try {
			const res = await fetch(RSS_FEED_URL);
			if (!res.ok) {
				console.error(`Error fetching RSS feed: ${res.status} ${res.statusText}`);
				const errorText = await res.text();
				console.error(`RSS Feed Response: ${errorText}`);
				return; // Stop execution if feed fetch fails
			}
			const xml = await res.text();
			console.log('RSS feed fetched successfully.');
			// console.log('XML Content:', xml.substring(0, 500)); // Log first 500 chars of XML

			// Use fast-xml-parser instead of DOMParser
			const parser = new XMLParser({ ignoreAttributes: false }); // Keep attributes if needed
			const jsonObj = parser.parse(xml);
			// console.log('Parsed JSON Object:', JSON.stringify(jsonObj, null, 2).substring(0, 1000)); // Log first 1000 chars of JSON

			// Access items based on typical RSS structure (adjust if needed for the specific feed)
			// Ensure item is an array, even if there's only one
			let items = jsonObj?.rss?.channel?.item || [];
			if (!Array.isArray(items)) {
				items = [items]; // Wrap single item in an array
			}
			items = items.slice(0, 5); // latest 5

			console.log(`Found ${items.length} items in the feed.`);

			if (items.length === 0) {
				console.log('No items found or parsed correctly. Check RSS structure and parser logic.');
				// console.log('Full parsed JSON:', JSON.stringify(jsonObj, null, 2)); // Log full JSON if no items found
			}

			for (const item of items) {
				// Access properties directly from the parsed JSON object
				const title = item.title;
				const link = item.link;
				const pubDate = item.pubDate;

				console.log(`Processing item: ${title}`);

				// Optional: filter or check if already sent (via KV or Supabase)

				if (!title || !link) {
					console.warn('Skipping item due to missing title or link:', item);
					continue;
				}

				const message = `📰 <b>${title}</b>\n<a href="${link}">閱讀全文</a>`;
				// Use env bindings instead of process.env
				const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
				const payload = {
					chat_id: env.TELEGRAM_CHAT_ID,
					text: message,
					parse_mode: 'HTML',
				};

				console.log(`Sending message to Telegram for item: ${title}`);
				const tgRes = await fetch(telegramUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				const tgResJson = await tgRes.json();
				if (!tgRes.ok) {
					console.error(`Error sending message to Telegram: ${tgRes.status} ${tgRes.statusText}`);
					console.error('Telegram API Response:', JSON.stringify(tgResJson, null, 2));
				} else {
					console.log(`Message sent successfully for item: ${title}`);
					// console.log('Telegram API Success Response:', JSON.stringify(tgResJson, null, 2));
				}
			}
		} catch (error) {
			console.error('An unexpected error occurred in the scheduled function:');
			if (error instanceof Error) {
				console.error(`Error Name: ${error.name}`);
				console.error(`Error Message: ${error.message}`);
				console.error(`Error Stack: ${error.stack}`);
			} else {
				console.error('Caught non-Error object:', error);
			}
		}
	},
};
