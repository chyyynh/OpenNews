import { createClient } from '@supabase/supabase-js';
import { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	OPENROUTER_API_KEY: string;
}

interface Article {
	id: string;
	title: string;
	summary: string | null;
	content: string | null;
	url: string;
	source: string;
	published_date: string;
	tags: string[];
	keywords: string[];
}

interface AIAnalysisResult {
	tags: string[];
	keywords: string[];
	summary: string;
	category: string;
}

interface OpenRouterResponse {
	choices: Array<{
		message: {
			content: string | null;
		};
	}>;
}

async function callGeminiForAnalysis(
	article: Article,
	openrouterApiKey: string
): Promise<AIAnalysisResult> {
	console.log(`Analyzing article: ${article.title.substring(0, 80)}...`);
	
	const content = article.content || article.summary || article.title;
	const prompt = `作為一個專業的新聞分析師，請分析以下新聞文章並提供結構化的分析結果。

文章資訊：
標題: ${article.title}
來源: ${article.source}
摘要: ${article.summary || '無摘要'}
內容: ${content.substring(0, 2000)}...

請以JSON格式回答，包含以下欄位：
{
  "tags": ["標籤1", "標籤2", "標籤3"],
  "keywords": ["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"],
  "summary": "用繁體中文寫1-2句話的新聞摘要",
  "category": "新聞分類"
}

標籤規則：
- AI相關: AI, MachineLearning, DeepLearning, NLP, ComputerVision
- 區塊鏈: Blockchain, Crypto, Bitcoin, Ethereum, DeFi, NFT
- 科技公司: Google, Apple, Microsoft, Meta, OpenAI, Anthropic
- 產業: Tech, Finance, Healthcare, Education, Gaming
- 事件類型: Funding, IPO, Acquisition, ProductLaunch, Research

分類選項: AI, Blockchain, Tech, Finance, Research, Business, Other

請只回傳JSON，不要其他文字。`;

	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${openrouterApiKey}`,
			'HTTP-Referer': 'https://opennews.tw',
			'X-Title': 'OpenNews Article Analysis',
		},
		body: JSON.stringify({
			model: 'google/gemini-2.5-flash-lite',
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: prompt,
						}
					]
				},
			],
			max_tokens: 800,
			temperature: 0.3,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		console.error('OpenRouter API Error:', response.status, response.statusText, errorBody);
		throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
	}

	const data: OpenRouterResponse = await response.json();
	const rawContent = data.choices?.[0]?.message?.content || '';
	
	if (!rawContent || !rawContent.trim()) {
		throw new Error('Empty response from AI');
	}

	console.log('Raw AI response:', rawContent);

	try {
		// Try to extract JSON from the response
		const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('No JSON found in response');
		}
		
		const result: AIAnalysisResult = JSON.parse(jsonMatch[0]);
		
		// Validate the result
		if (!Array.isArray(result.tags) || !Array.isArray(result.keywords) || !result.summary) {
			throw new Error('Invalid response format');
		}

		return {
			tags: result.tags.slice(0, 5), // Limit to 5 tags
			keywords: result.keywords.slice(0, 8), // Limit to 8 keywords
			summary: result.summary,
			category: result.category || 'Other'
		};
	} catch (parseError) {
		console.error('Failed to parse AI response:', parseError);
		console.error('Raw content:', rawContent);
		
		// Fallback: basic analysis
		return {
			tags: ['Other'],
			keywords: article.title.split(' ').slice(0, 5),
			summary: article.summary || article.title.substring(0, 100) + '...',
			category: 'Other'
		};
	}
}

async function processUntaggedArticles(supabase: any, env: Env): Promise<void> {
	// Fetch articles that need processing
	// Using OR condition to catch both empty arrays and null values
	const { data: articles, error } = await supabase
		.from('articles')
		.select('id, title, summary, content, url, source, published_date, tags, keywords')
		.or('tags.eq.[],keywords.eq.[]')
		.gte('scraped_date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Last 4 hours
		.order('scraped_date', { ascending: false })
		.limit(30); // Process 30 articles at a time

	if (error) {
		console.error('Error fetching untagged articles:', error);
		return;
	}

	if (!articles || articles.length === 0) {
		console.log('No untagged articles found');
		return;
	}

	console.log(`Found ${articles.length} articles to process`);

	// Process articles sequentially to avoid rate limiting
	for (const article of articles) {
		try {
			console.log(`Processing article ${article.id}: ${article.title}`);
			
			const analysis = await callGeminiForAnalysis(article, env.OPENROUTER_API_KEY);
			
			// Update the article with AI analysis
			const { error: updateError } = await supabase
				.from('articles')
				.update({
					tags: analysis.tags,
					keywords: analysis.keywords,
					summary: analysis.summary,
					// Store category in tags if not already present
					tags: [...analysis.tags, analysis.category].filter((v, i, a) => a.indexOf(v) === i)
				})
				.eq('id', article.id);

			if (updateError) {
				console.error(`Error updating article ${article.id}:`, updateError);
			} else {
				console.log(`✅ Successfully processed article ${article.id}`);
				console.log(`   Tags: ${analysis.tags.join(', ')}`);
				console.log(`   Keywords: ${analysis.keywords.join(', ')}`);
				console.log(`   Category: ${analysis.category}`);
			}

			// Add delay to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

		} catch (error) {
			console.error(`Error processing article ${article.id}:`, error);
			// Continue with next article
		}
	}
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('🤖 Article AI Analysis Worker started');
		
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
		
		try {
			await processUntaggedArticles(supabase, env);
			console.log('✅ Article AI Analysis Worker completed successfully');
		} catch (error) {
			console.error('❌ Article AI Analysis Worker failed:', error);
		}
	},

	// Optional: HTTP endpoint for manual triggering
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/process' && request.method === 'POST') {
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
			
			ctx.waitUntil(processUntaggedArticles(supabase, env));
			
			return new Response(JSON.stringify({ 
				status: 'started', 
				message: 'Article processing started' 
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		return new Response('OpenNews Article AI Analysis Worker\n\nPOST /process - Manually trigger processing', {
			headers: { 'Content-Type': 'text/plain' }
		});
	},
};