import { createClient } from '@supabase/supabase-js';
// Import both utility functions
import { sendMessageToTelegram, summarizeWithGemini } from './utils';
// Remove direct import of GoogleGenerativeAI components here

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	GEMINI_API_KEY: string; // Added Gemini API Key
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// 获取当天文章
		const now = new Date();
		const today = new Date().toISOString().split('T')[0];
		const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

		const { data: articles, error } = await supabase
			.from('articles')
			.select('title, url, source, tags')
			.gte('scraped_date', startOfDay.toISOString())
			.lte('scraped_date', endOfDay.toISOString());

		if (error) {
			console.error('Error fetching articles:', error);
			return;
		}

		if (!articles.length) {
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `📅 ${today} Crypto 新聞總結\n無新文章`);
			return;
		}

		// 按類別整理
		const categories: { [key: string]: any[] } = {};
		articles.forEach((article) => {
			const category = article.tags?.category || '其他';
			if (!categories[category]) categories[category] = [];
			categories[category].push(article);
		});

		// 生成報告
		let report = `📅 ${today} Crypto 新聞總結\n\n`;
		for (const [category, items] of Object.entries(categories)) {
			report += `【${category}】\n`;
			items.forEach((item) => {
				const coins = item.tags?.coins?.join(', ') || '無';
				report += `- ${item.source}: ${item.title} (幣種: ${coins})\n  ${item.url}\n`;
			});
			report += '\n'; // Keep the original report generation for input to AI
		}

		// --- AI Summarization using Utility Function ---
		try {
			// The 'articles' data fetched from Supabase should match the ArticleForSummary interface
			// defined in utils.ts because we selected title, url, source, and tags.
			const summary = await summarizeWithGemini(env.GEMINI_API_KEY, articles);

			// Prepend the date header to the AI summary
			const finalReport = `📅 ${today} Crypto 新聞 AI 摘要\n\n${summary}`; // summary is already truncated in the util if needed

			// --- Send AI Summary ---
			console.log('Sending AI summary to Telegram...');
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, finalReport);
			console.log('AI Daily report sent successfully');
		} catch (aiError) {
			console.error('Error during AI summarization or sending:', aiError);
			// Send a fallback error message (error handling remains here)
			let errorMessage = '未知錯誤';
			if (aiError instanceof Error) {
				errorMessage = aiError.message;
			} else if (typeof aiError === 'string') {
				errorMessage = aiError;
			}
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `📅 ${today} AI 摘要生成失敗: ${errorMessage}`);
		}
	},
};
