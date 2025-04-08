import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram } from './utils';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_ANON_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const rssFeedUrl = 'https://www.coindesk.com/arc/outboundfeeds/rss';

		// Create Supabase client
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

		try {
			const response = await fetch(rssFeedUrl);
			const rssContent = await response.text();

			const parser = new XMLParser();
			const rssData = parser.parse(rssContent);

			if (!rssData?.rss?.channel?.item) {
				console.error('Invalid RSS feed format');
				return;
			}

			const items = rssData.rss.channel.item;

			// Check if table exists, create if not
			const { error: createTableError } = await supabase.from('articles').select('*', { head: true });
			if (createTableError) {
				const { error: createError } = await supabase.from('articles').insert([
					{ id: 1, title: 'Initial article' }, // Dummy data to create the table
				]);
				if (createError) {
					console.error('Error creating table:', createError);
					return;
				}
			}

			// Fetch existing article titles from the database
			const { data: existingArticles, error: fetchError } = await supabase.from('articles').select('title');

			if (fetchError) {
				console.error('Error fetching articles:', fetchError);
				return;
			}

			const existingTitles = existingArticles.map((article) => article.title);

			// Compare the titles of new articles with the existing ones
			const newArticles = items.filter((item: any) => !existingTitles.includes(item.title));

			// Insert the new article titles into the database
			for (const article of newArticles) {
				const { error: insertError } = await supabase.from('articles').insert([{ title: article.title }]);

				if (insertError) {
					console.error('Error inserting article:', insertError);
				} else {
					console.log('New article:', article.title);
					// Send message to Telegram
					await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `New article: ${article.title}`);
				}
			}

			console.log('New articles:', newArticles);
		} catch (error) {
			console.error('Error fetching or parsing RSS feed:', error);
		}
	},
};
