import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram } from './utils';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const parser = new XMLParser({ ignoreAttributes: false });
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// Get the list of RSS feeds from the RssList table
		const { data: rssFeeds, error: fetchRssListError } = await supabase.from('RssList').select('id, name, RSSLink, url'); // Only select RSS feeds that haven't been processed yet

		console.log('Fetched RSS feeds:', rssFeeds);

		if (fetchRssListError) {
			console.error('Error fetching RSS feeds from RssList:', fetchRssListError);
			return;
		}

		// Loop through each feed in the RssList table
		for (const feed of rssFeeds) {
			try {
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
					const pubDate = item.pubDate || item.isoDate || null;
					const summary = item.description || item['content:encoded'] || '';
					const categories = item.category ? (Array.isArray(item.category) ? item.category : [item.category]) : [];

					const insert = {
						url: item.link,
						title: item.title,
						source: feed.name,
						published_date: pubDate ? new Date(pubDate) : null,
						scraped_date: new Date(),
						categories,
						tags: [], // optional
						summary,
					};

					const { error: insertError } = await supabase.from('articles').insert([insert]);

					if (insertError) {
						console.error(`[${feed.name}] Insert error:`, insertError);
					} else {
						await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `📰 ${feed.name}:${item.title}\n\n${item.link}`);
						console.log(`[${feed.name}] New article: ${item.title}`);
					}
				}

				// Update the RssList table with the latest scrape time and RSSLink
				const { error: updateError } = await supabase
					.from('RssList')
					.update({
						scraped_at: new Date(),
						RSSLink: feed.url, // Store the URL as the processed link
					})
					.eq('id', feed.id);

				if (updateError) {
					console.error(`[${feed.name}] Failed to update RssList:`, updateError);
				} else {
					console.log(`[${feed.name}] Updated RssList table`);
				}
			} catch (err) {
				console.error(`[${feed.name}] Failed to parse`, err);
			}
		}
	},
};
