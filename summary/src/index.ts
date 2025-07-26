import { createClient } from '@supabase/supabase-js';
import { sendMessageToTelegram, summarizeWithDeepSeek } from './utils';
import { postThread } from './twitter';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;
	TWITTER_KV: KVNamespace;
	GEMINI_API_KEY: string;
	DEEPSEEK_API_KEY: string;
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
			reportInput += `【${category}】\n`;
			items.forEach((item) => {
				const coins = item.tags?.coins?.join(', ') || '無';
				reportInput += `- ${item.source}: ${item.title} (幣種: ${coins})\n  ${item.url}\n`; // Changed variable name from report to reportInput
			});
			reportInput += '\n'; // Keep the original report generation for input to AI
		}

		try {
			// Use the new AI summarization utility function
			const summary = await summarizeWithDeepSeek(env.DEEPSEEK_API_KEY, articles);
			const finalReport = `[summary] ${timeWindowIdentifier}\n\n${summary}`;

			// --- Telegram Posting ---
			console.log(`Sending summary for ${timeWindowIdentifier} to Telegram...`);
			try {
				// Get all user telegram IDs from Supabase
				const { data: users, error: usersError } = await supabase.from('user_preferences').select('telegram_id');

				if (usersError) {
					console.error('Error fetching users:', usersError);
					return;
				}

				if (!users || users.length === 0) {
					console.log('No users found to send message to');
					return;
				}

				// Send message to all users
				for (const user of users) {
					try {
						await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, user.telegram_id.toString(), finalReport);
					} catch (singleUserError) {
						console.error(`Failed to send message to user ${user.telegram_id}:`, singleUserError);
					}
				}
				console.log('telegram: AI Daily report sent successfully');
			} catch (telegramError) {
				console.error('telegram: Failed to send message:', telegramError);
			}

			// --- Twitter Posting ---
			console.log(`Posting summary for ${timeWindowIdentifier} to Twitter...`);
			try {
				await postThread(env, finalReport);
				console.log('twitter: AI Daily report sent successfully');
			} catch (twitterError) {
				console.error('twitter: Failed to post thread:', twitterError);
			}
		} catch (aiError) {
			console.error('Error during AI summarization or sending:', aiError);
			let errorMessage = '未知錯誤';
			if (aiError instanceof Error) {
				errorMessage = aiError.message;
			} else if (typeof aiError === 'string') {
				errorMessage = aiError;
			}
			// Send error message to all users
			const { data: users, error: usersError } = await supabase.from('user_preferences').select('telegram_id');

			if (!usersError && users && users.length > 0) {
				for (const user of users) {
					try {
						await sendMessageToTelegram(
							env.TELEGRAM_BOT_TOKEN,
							user.telegram_id.toString(),
							`兵法推演失策 (${timeWindowIdentifier}): ${errorMessage}`
						);
					} catch (singleUserError) {
						console.error(`Failed to send error message to user ${user.telegram_id}:`, singleUserError);
					}
				}
			}
		}
	},
};
