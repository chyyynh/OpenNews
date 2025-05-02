import { createClient } from '@supabase/supabase-js';
// Import both utility functions
import { sendMessageToTelegram, summarizeWithGemini, postToTwitter } from './utils';
import { postTweetThread } from './twitter';
// Remove direct import of GoogleGenerativeAI components here

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	GEMINI_API_KEY: string;
	TWITTER_BEARER_TOKEN: string;
	TWITTER_API_KEY: string;
	TWITTER_API_KEY_SECRET: string;
	ACCESS_TOKEN: string;
	ACCESS_TOKEN_SECRET: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// Calculate time window: 90 to 180 minutes ago
		const now = new Date();
		const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);
		const oneEightyMinutesAgo = new Date(now.getTime() - 180 * 60 * 1000);
		const timeWindowIdentifier = `${oneEightyMinutesAgo.toISOString().substring(11, 16)} - ${ninetyMinutesAgo
			.toISOString()
			.substring(11, 16)} UTC`; // For logging/reporting

		console.log(`Fetching articles between ${oneEightyMinutesAgo.toISOString()} and ${ninetyMinutesAgo.toISOString()}`);

		const { data: articles, error } = await supabase
			.from('articles')
			.select('title, url, source, tags')
			.gte('scraped_date', oneEightyMinutesAgo.toISOString()) // Greater than or equal to 180 mins ago
			.lt('scraped_date', ninetyMinutesAgo.toISOString()); // Less than 90 mins ago

		if (error) {
			console.error(`Error fetching articles for window ${timeWindowIdentifier}:`, error);
			return;
		}

		if (!articles || !articles.length) {
			console.log(`No new articles found for window ${timeWindowIdentifier}.`);
			// Optionally send a message or just exit quietly
			// await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `🔍 ${timeWindowIdentifier}: 無新文章`);
			return;
		}

		console.log(`Found ${articles.length} articles for window ${timeWindowIdentifier}.`);

		// 按類別整理
		const categories: { [key: string]: any[] } = {};
		articles.forEach((article) => {
			const category = article.tags?.category || '其他';
			if (!categories[category]) categories[category] = [];
			categories[category].push(article);
		});

		// 生成報告 (This raw report is now just input for the AI)
		let reportInput = `Time Window: ${timeWindowIdentifier}\n\n`; // Changed variable name from report to reportInput
		for (const [category, items] of Object.entries(categories)) {
			// Use the original categories variable
			reportInput += `【${category}】\n`;
			items.forEach((item) => {
				const coins = item.tags?.coins?.join(', ') || '無';
				reportInput += `- ${item.source}: ${item.title} (幣種: ${coins})\n  ${item.url}\n`; // Changed variable name from report to reportInput
			});
			reportInput += '\n'; // Keep the original report generation for input to AI
		}

		// --- AI Summarization using Utility Function ---
		try {
			// The 'articles' data fetched from Supabase should match the ArticleForSummary interface
			// defined in utils.ts because we selected title, url, source, and tags.
			// Pass the articles and the desired style to the summarizer
			const summary = await summarizeWithGemini(env.GEMINI_API_KEY, articles, 'Sun Tzu'); // Pass 'Sun Tzu' style

			// Format the final report with the new style
			const finalReport = `[summary] ${timeWindowIdentifier}\n\n${summary}`; // Use new header and style

			// --- Send AI Summary ---
			console.log(`Sending Sun Tzu summary for ${timeWindowIdentifier} to Telegram...`);
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, finalReport);
			console.log('telegram: AI Daily report sent successfully');
			// await postToTwitter(env.TWITTER_API_KEY, env.TWITTER_API_KEY_SECRET, env.ACCESS_TOKEN, env.ACCESS_TOKEN_SECRET, finalReport);
			// console.log('twitter: AI Daily report sent successfully');
		} catch (aiError) {
			console.error('Error during AI summarization or sending:', aiError);
			// Send a fallback error message (error handling remains here)
			let errorMessage = '未知錯誤';
			if (aiError instanceof Error) {
				errorMessage = aiError.message;
			} else if (typeof aiError === 'string') {
				errorMessage = aiError;
			}
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `兵法推演失策 (${timeWindowIdentifier}): ${errorMessage}`);
		}
	},
};
