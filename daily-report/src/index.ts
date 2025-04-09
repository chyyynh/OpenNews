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
			report += '\n';
		}

		// 發送報告
		try {
			await sendMessageToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, report);
			console.log('Daily report sent successfully');
		} catch (error) {
			console.error('Error sending daily report:', error);
		}
	},
};
