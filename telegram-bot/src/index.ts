/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { createClient } from '@supabase/supabase-js';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	GEMINI_API_KEY: string;
	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;
	TWITTER_KV: KVNamespace;
}

export default {
	async fetch(request: Request, env: any) {
		const payload = (await request.json()) as {
			message?: { text?: string; chat: { id: number } };
			callback_query?: { from: { id: number }; data: string };
		};

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// 1️⃣ 處理 /start 指令
		if (payload.message?.text === '/start') {
			const chatId = payload.message.chat.id;

			await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					text: '請選擇你感興趣的主題：',
					reply_markup: {
						inline_keyboard: [
							[{ text: '🧠 AI', callback_data: 'tag:AI' }],
							[{ text: '🪙 Crypto', callback_data: 'tag:Crypto' }],
							[{ text: '🎮 Game', callback_data: 'tag:Game' }],
						],
					},
				}),
			});

			return new Response('ok');
		}

		if (payload.callback_query) {
			const chatId = payload.callback_query.from.id;
			const tag = payload.callback_query.data.replace('tag:', '');

			const { data: existing, error: selectError } = await supabase.from('users_subtags').select('subtags').eq('chatId', chatId).single();

			if (selectError && selectError.code !== 'PGRST116') {
				// 非 "no rows returned" 的錯誤，處理錯誤
				console.error('Error selecting user:', selectError);
				return;
			}

			if (existing) {
				// 已存在，更新 subtags（合併新的 tag）
				const updatedSubtags = [...new Set([...existing.subtags, tag])];
				await supabase.from('users_subtags').update({ subtags: updatedSubtags }).eq('chatId', chatId);
			} else {
				// 不存在，插入新的紀錄
				await supabase.from('users_subtags').insert([
					{
						chatId: chatId,
						subtags: [tag],
					},
				]);
			}

			// 回覆使用者
			await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					text: `你已訂閱「${tag}」新聞 ✅`,
				}),
			});

			return new Response('callback handled');
		}

		return new Response('ok');
	},
};
