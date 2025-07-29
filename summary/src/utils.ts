export async function sendMessageToTelegram(token: string, chatId: string, message: string) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body = JSON.stringify({
		chat_id: chatId,
		text: message,
		parse_mode: 'Markdown',
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
			const errorBody = await response.text(); // Get the response body for detailed error
			if (response.status === 401) {
				console.warn(`User ${chatId} hasn't started conversation with bot (401 Unauthorized)`);
			} else {
				console.error('Error sending message to Telegram:', response.status, response.statusText, 'Body:', errorBody);
			}
			throw new Error(`Telegram API Error: ${response.status} ${response.statusText} - ${errorBody}`);
		}
	} catch (error) {
		console.error('Error sending message to Telegram:', error);
		// Re-throw the error so the caller can handle it if needed
		throw error;
	}
}

// --- New AI Summarization Utility Function ---

// Define a simple structure for articles expected by the summarizer
interface ArticleForSummary {
	title: string;
	url: string;
	source: string;
	tags?: {
		category?: string;
		coins?: string[];
	};
}

// DeepSeek API response types
interface DeepSeekMessage {
	role: string;
	content: string;
}

interface DeepSeekChoice {
	message: DeepSeekMessage;
	finish_reason: string;
	index: number;
}

interface DeepSeekResponse {
	choices: DeepSeekChoice[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export async function summarizeWithDeepSeek(apiKey: string, articles: ArticleForSummary[]): Promise<string> {
	try {
		// Prepare the prompt using the structured data
		let articlesForPrompt = '';
		// Group by category for better structure in the prompt
		const categories: { [key: string]: ArticleForSummary[] } = {};
		articles.forEach((article) => {
			const category = article.tags?.category || '其他';
			if (!categories[category]) categories[category] = [];
			categories[category].push(article);
		});

		for (const [category, items] of Object.entries(categories)) {
			articlesForPrompt += `【${category}】\n`;
			items.forEach((item) => {
				articlesForPrompt += `- ${item.source}: ${item.title}\n  ${item.url}\n`;
			});
			articlesForPrompt += '\n';
		}

		// --- Construct Prompt ---
		const prompt = `請根據以下 AI 新聞文章列表，產生一份簡潔的中文摘要報告。
			目標是總結每則新聞成一句標題，並依照重要性1-10分打分和排序，並附上連結。
			請使用 Telegram Markdown 語法格式。

			範例格式：
			---
			1. [Meta推出手势控制腕带利用AI解读肌肉信号](https://newslink) (10/10)
			2. [Grok推出新App连接器提升生产力](https://newslink) (7/10)
			3. [a16z：AI行业正处于扩张阶段需积极投资](https://newslink) (3/10)
			---

			新聞列表：
			---
			${articlesForPrompt}
			---

			請生成 Telegram Markdown 格式的摘要報告：`;
		console.log('Using default summary prompt.');

		console.log('Sending request to DeepSeek API via utils...');
		const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: 'deepseek-chat',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.7,
				max_tokens: 1024,
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText} - ${errorBody}`);
		}

		const data: DeepSeekResponse = await response.json();
		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			throw new Error('DeepSeek API Error: No response received.');
		}

		const summary = data.choices[0].message.content;
		console.log('DeepSeek Summary Received via utils (length):', summary.length);

		if (summary.length > 4096) {
			console.warn(`DeepSeek summary exceeded 4096 chars (${summary.length}). Returning truncated version.`);
			return summary.substring(0, 4096); // Truncate if needed, although we asked for less
		}

		return summary;
	} catch (error) {
		console.error('Error during AI summarization in utils:', error);
		// Re-throw the error to be handled by the main scheduled function
		throw error;
	}
}
