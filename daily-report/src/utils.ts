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
			const errorBody = await response.text(); // Get the response body for detailed error
			console.error('Error sending message to Telegram:', response.status, response.statusText, 'Body:', errorBody);
			// Throw an error to propagate it back if needed, or handle it here
			throw new Error(`Telegram API Error: ${response.status} ${response.statusText} - ${errorBody}`);
		}
	} catch (error) {
		console.error('Error sending message to Telegram:', error);
		// Re-throw the error so the caller can handle it if needed
		throw error;
	}
}

// --- New AI Summarization Utility Function ---
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

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

export async function summarizeWithGemini(apiKey: string, articles: ArticleForSummary[]): Promise<string> {
	try {
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

		const generationConfig = {
			temperature: 0.7,
			topK: 1,
			topP: 1,
			maxOutputTokens: 1024, // Aiming for ~4000 chars
		};

		const safetySettings = [
			{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
		];

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
				const coins = item.tags?.coins?.join(', ') || '無';
				articlesForPrompt += `- ${item.source}: ${item.title} (幣種: ${coins})\n  ${item.url}\n`;
			});
			articlesForPrompt += '\n';
		}

		const prompt = `請根據以下 Crypto 新聞文章列表，產生一份簡潔的中文摘要報告。
目標是總結當天的主要新聞亮點，並確保最終報告的總長度嚴格控制在 4000 個字元以內。
請保留重要的資訊，例如主要事件、涉及的幣種和來源。

新聞列表：
---
${articlesForPrompt}
---

請生成摘要報告：`;

		console.log('Sending request to Gemini API via utils...');
		const result = await model.generateContent({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			generationConfig,
			safetySettings,
		});

		if (!result.response) {
			throw new Error('Gemini API Error: No response received.');
		}

		const summary = result.response.text();
		console.log('Gemini Summary Received via utils (length):', summary.length);

		if (summary.length > 4096) {
			console.warn(`Gemini summary exceeded 4096 chars (${summary.length}). Returning truncated version.`);
			return summary.substring(0, 4096); // Truncate if needed, although we asked for less
		}

		return summary;
	} catch (error) {
		console.error('Error during AI summarization in utils:', error);
		// Re-throw the error to be handled by the main scheduled function
		throw error;
	}
}
