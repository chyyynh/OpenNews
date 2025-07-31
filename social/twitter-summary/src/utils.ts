import twitterText from 'twitter-text';

interface ArticleWithScore {
	id: string;
	title: string;
	url: string;
	summary: string | null;
	published_date: string;
	source: string;
	tags: string[];
	keywords: string[];
	score: number;
}

function calculateImportanceScore(article: any): number {
	let score = 0;
	
	// 基於關鍵字的重要性評分
	const importantKeywords = [
		// AI/Tech
		'AI', 'artificial intelligence', 'ChatGPT', 'OpenAI', 'Claude', 'Anthropic',
		'Google', 'Meta', 'Microsoft', 'Apple', 'Tesla', 'NVIDIA',
		'breakthrough', '突破', 'innovation', '創新',
		
		// Business/Finance
		'funding', '融資', 'IPO', 'acquisition', '收購', 'merger', '合併',
		'investment', '投資', 'valuation', '估值', 'billion', 'million',
		
		// Regulation/Policy
		'regulation', '法規', 'policy', '政策', 'ban', '禁令', 'lawsuit', '訴訟',
		'government', '政府', 'congress', '國會', 'senate', '參議院',
		
		// Security/Privacy
		'security', '安全', 'privacy', '隱私', 'breach', '洩露', 'hack', '駭客',
		'vulnerability', '漏洞', 'attack', '攻擊',
		
		// Crypto/Blockchain (if relevant)
		'Bitcoin', 'Ethereum', 'crypto', '加密貨幣', 'blockchain', '區塊鏈'
	];
	
	const titleLower = article.title.toLowerCase();
	const summaryLower = (article.summary || '').toLowerCase();
	
	// 標題中的關鍵字權重更高
	importantKeywords.forEach(keyword => {
		if (titleLower.includes(keyword.toLowerCase())) score += 5;
		if (summaryLower.includes(keyword.toLowerCase())) score += 2;
	});
	
	// 基於標籤的評分
	const importantTags = [
		'AI', 'Regulation', 'Security', 'Funding', 'Layer1', 
		'DeFi', 'NFT', 'GameFi', 'DAO', 'Exchange'
	];
	if (article.tags && Array.isArray(article.tags)) {
		article.tags.forEach((tag: string) => {
			if (importantTags.includes(tag)) score += 3;
		});
	}
	
	// 基於來源的評分 - 權威來源給予更高分數
	const premiumSources = [
		'OpenAI', 'Google Deepmind', 'Anthropic', 'CNBC', 'Techcrunch',
		'Hacker News AI', 'arXiv cs.AI', 'arXiv cs.LG'
	];
	if (premiumSources.includes(article.source)) {
		score += 4;
	}
	
	// 時間新鮮度評分 (越新越高分)
	const publishedTime = new Date(article.published_date).getTime();
	const hoursOld = (Date.now() - publishedTime) / (1000 * 60 * 60);
	
	if (hoursOld < 2) score += 5;        // 2小時內
	else if (hoursOld < 6) score += 4;   // 6小時內  
	else if (hoursOld < 12) score += 3;  // 12小時內
	else if (hoursOld < 24) score += 2;  // 24小時內
	else if (hoursOld < 48) score += 1;  // 48小時內
	
	// 標題長度適中的文章可能更重要
	const titleLength = article.title.length;
	if (titleLength > 20 && titleLength < 100) {
		score += 1;
	}
	
	return score;
}

export async function selectTopArticle(supabase: any): Promise<ArticleWithScore | null> {
	// 獲取過去4小時內的文章
	const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
	
	const { data: articles, error } = await supabase
		.from('articles')
		.select('id, title, url, summary, published_date, source, tags, keywords')
		.gte('published_date', fourHoursAgo.toISOString())
		.order('published_date', { ascending: false })
		.limit(100); // 取最新的100篇文章進行評估
	
	if (error) {
		console.error('Error fetching articles:', error);
		return null;
	}
	
	if (!articles || articles.length === 0) {
		console.log('No articles found in the last 4 hours');
		return null;
	}
	
	console.log(`Found ${articles.length} articles in the last 4 hours`);
	
	// 計算每篇文章的重要性分數
	const articlesWithScores: ArticleWithScore[] = articles.map(article => ({
		...article,
		score: calculateImportanceScore(article)
	}));
	
	// 按分數排序，選擇最高分的文章
	articlesWithScores.sort((a, b) => b.score - a.score);
	
	// 記錄前5名文章的分數，用於調試
	console.log('Top 5 articles by score:');
	articlesWithScores.slice(0, 5).forEach((article, index) => {
		console.log(`${index + 1}. Score: ${article.score} - ${article.title.substring(0, 80)}...`);
	});
	
	return articlesWithScores[0];
}

async function callDeepSeek(prompt: string, deepseekApiKey: string, temperature: number = 0.8): Promise<string> {
	const response = await fetch('https://api.deepseek.com/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${deepseekApiKey}`,
		},
		body: JSON.stringify({
			model: 'deepseek-chat',
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 400,
			temperature,
		}),
	});

	if (!response.ok) {
		throw new Error(`DeepSeek API error: ${response.status}`);
	}

	const data = await response.json();
	const summary = data.choices?.[0]?.message?.content || '';
	
	if (!summary.trim()) {
		throw new Error('Generated summary is empty');
	}
	
	return summary.trim();
}

export async function generateTwitterSummary(article: ArticleWithScore, deepseekApiKey: string): Promise<string> {
	const maxCharacters = 240; // 為 URL 預留空間
	const maxRetries = 3;
	
	// 計算 URL 長度（Twitter 會自動縮短 URL 為 23 字符）
	const urlLength = 23;
	const availableChars = maxCharacters - urlLength - 4; // 減去 \n\n 和一些緩衝

	let attempt = 0;
	let finalTweet = '';

	while (attempt < maxRetries) {
		attempt++;
		
		const basePrompt = `作為一個專業的科技新聞分析師，請為以下新聞撰寫一則適合 Twitter 的簡潔評論推文：

要求：
1. 使用繁體中文
2. 嚴格限制在 ${availableChars} 字符以內（包含中文字符、英文、標點符號、hashtag）
3. 突出新聞的核心價值和重要性
4. 語調專業但通俗易懂
5. 使用1-2個相關的 hashtags (#AI #科技 #新聞 等)
6. 不要包含連結（會另外添加）
7. 要吸引人點擊和分享

新聞資訊：
標題: ${article.title}
來源: ${article.source}
摘要: ${article.summary || "無摘要"}
重要性評分: ${article.score}/20`;

		// 根據嘗試次數調整 prompt
		let prompt = basePrompt;
		if (attempt === 2) {
			prompt += `\n\n注意：請更加簡潔，上次生成的內容太長了。限制在 ${availableChars} 字符以內。`;
		} else if (attempt === 3) {
			prompt += `\n\n重要：這是最後一次嘗試，請務必控制在 ${availableChars} 字符以內，可以犧牲一些細節來確保字數限制。`;
		}
		
		prompt += '\n\n請直接提供推文內容，不要其他說明：';

		console.log(`Attempt ${attempt}: Generating Twitter summary...`);
		
		const summary = await callDeepSeek(prompt, deepseekApiKey, 0.7 + (attempt * 0.1));
		
		// 使用 twitter-text 精確計算字數
		const parsedTweet = twitterText.parseTweet(summary);
		const charCount = parsedTweet.weightedLength;
		console.log(`Generated summary character count: ${charCount}/${availableChars}`);
		console.log(`Summary: ${summary}`);
		
		if (charCount <= availableChars) {
			finalTweet = summary;
			break;
		} else {
			console.log(`Summary too long (${charCount} chars), retrying...`);
			if (attempt === maxRetries) {
				// 最後手段：強制截斷
				console.log('Max retries reached, truncating...');
				finalTweet = summary.substring(0, availableChars - 3) + '...';
			}
		}
	}
	
	// 添加文章連結
	const tweetWithUrl = `${finalTweet}\n\n${article.url}`;
	
	// 最終驗證總長度
	const finalParsed = twitterText.parseTweet(tweetWithUrl);
	const finalCharCount = finalParsed.weightedLength;
	console.log(`Final tweet character count: ${finalCharCount}/${maxCharacters}`);
	
	if (finalCharCount > maxCharacters) {
		console.warn(`Final tweet still exceeds limit: ${finalCharCount}/${maxCharacters}`);
		// 緊急截斷
		const emergencyTweet = finalTweet.substring(0, availableChars - 10) + '...\n\n' + article.url;
		const emergencyParsed = twitterText.parseTweet(emergencyTweet);
		console.log(`Emergency truncated tweet: ${emergencyParsed.weightedLength} chars`);
		return emergencyTweet;
	}
	
	return tweetWithUrl;
}