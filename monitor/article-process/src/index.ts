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
	title_cn?: string | null;
	summary: string | null;
	summary_cn?: string | null;
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
	summary_en: string;
	summary_cn: string;
	title_en?: string;
	title_cn?: string;
	category: string;
}

interface OpenRouterResponse {
	choices: Array<{
		message: {
			content: string | null;
		};
	}>;
}

async function callGeminiForAnalysis(article: Article, openrouterApiKey: string): Promise<AIAnalysisResult> {
	console.log(`Analyzing article: ${article.title.substring(0, 80)}...`);

	const content = article.content || article.summary || article.title;
	const prompt = `作為一個專業的新聞分析師和翻譯師，請分析以下新聞文章並提供結構化的分析結果，包含英文和中文版本。
		文章資訊：
		標題: ${article.title}
		來源: ${article.source}
		摘要: ${article.summary || article.summary_cn || '無摘要'}
		內容: ${content.substring(0, 2000)}...

		請以JSON格式回答，包含以下欄位：
		{
		"tags": ["標籤1", "標籤2", "標籤3"],
		"keywords": ["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"],
		"title_en": "英文標題翻譯",
		"title_cn": "繁體中文標題",
		"summary_en": "English summary in 1-2 sentences",
		"summary_cn": "用繁體中文寫1-2句話的新聞摘要",
		"category": "新聞分類"
		}

		翻譯要求：
		- title_en: 將標題翻譯成自然流暢的英文
		- title_cn: 如果原標題是英文，翻譯成繁體中文；如果已是中文，保持原樣
		- summary_en: 用英文寫簡潔的摘要
		- summary_cn: 用繁體中文寫簡潔的摘要

		標籤規則：
		- AI相關: AI, MachineLearning, DeepLearning, NLP, ComputerVision, LLM, GenerativeAI
		- 產品相關: Coding, VR, AR, Robotics, Automation, SoftwareDevelopment, API
		- 產業應用: Tech, Finance, Healthcare, Education, Gaming, Enterprise, Creative
		- 事件類型: Funding, IPO, Acquisition, ProductLaunch, Research, Partnership
		- 新聞性質: Review, Opinion, Analysis, Feature, Interview, Tutorial, Announcement

		分類選項: AI, Tech, Finance, Research, Business, Other

		請只回傳JSON，不要其他文字。`;

	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${openrouterApiKey}`,
			'HTTP-Referer': 'https://opennews.tw',
			'X-Title': 'OpenNews Article Process',
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
						},
					],
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
		if (!Array.isArray(result.tags) || !Array.isArray(result.keywords) || !result.summary_en || !result.summary_cn) {
			throw new Error('Invalid response format');
		}

		return {
			tags: result.tags.slice(0, 5), // Limit to 5 tags
			keywords: result.keywords.slice(0, 8), // Limit to 8 keywords
			summary_en: result.summary_en,
			summary_cn: result.summary_cn,
			title_en: result.title_en,
			title_cn: result.title_cn,
			category: result.category || 'Other',
		};
	} catch (parseError) {
		console.error('Failed to parse AI response:', parseError);
		console.error('Raw content:', rawContent);

		// Fallback: basic analysis
		return {
			tags: ['Other'],
			keywords: article.title.split(' ').slice(0, 5),
			summary_en: article.summary || article.title.substring(0, 100) + '...',
			summary_cn: article.summary_cn || article.summary || article.title.substring(0, 100) + '...',
			title_en: article.title,
			title_cn: article.title_cn || article.title,
			category: 'Other',
		};
	}
}

async function processUntaggedArticles(supabase: any, env: Env): Promise<void> {
	// First, let's check what articles exist in the timeframe
	const timeframe = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
	console.log(`Looking for articles since: ${timeframe}`);

	// Fetch all recent articles first to debug
	const { data: allArticles, error: allError } = await supabase
		.from('articles')
		.select('id, title, title_cn, tags, keywords, scraped_date, published_date')
		.gte('scraped_date', timeframe)
		.order('scraped_date', { ascending: false })
		.limit(10);

	if (allError) {
		console.error('Error fetching all articles:', allError);
		return;
	}

	console.log(`Total articles in timeframe: ${allArticles?.length || 0}`);
	if (allArticles && allArticles.length > 0) {
		allArticles.forEach((article) => {
			console.log(
				`  Article ${article.id}: tags=[${article.tags?.join(',') || 'null'}], keywords=[${article.keywords?.join(',') || 'null'}]`
			);
		});
	}

	// Now fetch articles that need processing
	const { data: articles, error } = await supabase
		.from('articles')
		.select('id, title, title_cn, summary, summary_cn, content, url, source, published_date, tags, keywords, scraped_date')
		.gte('scraped_date', timeframe)
		.order('published_date', { ascending: false })
		.limit(100);

	if (error) {
		console.error('Error fetching untagged articles:', error);
		return;
	}

	if (!articles || articles.length === 0) {
		console.log('No articles found in the time range');
		return;
	}

	// Filter articles that actually need processing (null, empty, or very short arrays)
	const articlesToProcess = articles.filter((article) => {
		const needsTags = !article.tags || article.tags.length === 0;
		const needsKeywords = !article.keywords || article.keywords.length === 0;
		const needsTranslation = !article.title_cn; // Check if missing Chinese title
		const shouldProcess = needsTags || needsKeywords || needsTranslation;

		// Debug logging for filtering
		if (!shouldProcess) {
			console.log(
				`⏭️  Skipping article ${article.id}: already has tags=[${article.tags?.join(',') || 'null'}] keywords=[${
					article.keywords?.join(',') || 'null'
				}] title_cn=[${article.title_cn || 'null'}]`
			);
		} else {
			console.log(
				`🔄 Will process article ${article.id}: needs tags=${needsTags}, keywords=${needsKeywords}, translation=${needsTranslation}`
			);
		}

		return shouldProcess;
	});

	if (articlesToProcess.length === 0) {
		console.log('No articles need AI analysis');
		return;
	}

	console.log(`Found ${articlesToProcess.length} articles to process (out of ${articles.length} total)`);

	let processedCount = 0;
	let errorCount = 0;

	// Process articles sequentially to avoid rate limiting
	for (const article of articlesToProcess) {
		try {
			console.log(`Processing article ${article.id}: ${article.title}`);

			const analysis = await callGeminiForAnalysis(article, env.OPENROUTER_API_KEY);

			// Update the article with AI analysis
			// Combine tags and category, removing duplicates
			const allTags = [...analysis.tags, analysis.category].filter((v, i, a) => a.indexOf(v) === i);

			// Prepare update object with only necessary fields
			const updateData: any = {};

			// Update tags and keywords if needed
			if (!article.tags || article.tags.length === 0) {
				updateData.tags = allTags;
			}
			if (!article.keywords || article.keywords.length === 0) {
				updateData.keywords = analysis.keywords;
			}

			// Update translation fields if needed
			if (!article.title_cn) {
				updateData.title = analysis.title_en || article.title; // Use English title as default
				updateData.title_cn = analysis.title_cn;
				updateData.summary = analysis.summary_en; // English summary
				updateData.summary_cn = analysis.summary_cn; // Chinese summary
			}

			const { error: updateError } = await supabase.from('articles').update(updateData).eq('id', article.id);

			if (updateError) {
				console.error(`Error updating article ${article.id}:`, updateError);
				errorCount++;
			} else {
				console.log(`✅ Successfully processed article ${article.id}`);
				console.log(`   Updated fields: ${Object.keys(updateData).join(', ')}`);
				if (updateData.tags) console.log(`   Tags: ${updateData.tags.join(', ')}`);
				if (updateData.keywords) console.log(`   Keywords: ${updateData.keywords.join(', ')}`);
				if (updateData.title_cn) {
					console.log(`   Title EN: ${analysis.title_en}`);
					console.log(`   Title CN: ${analysis.title_cn}`);
					console.log(`   Summary EN: ${analysis.summary_en}`);
					console.log(`   Summary CN: ${analysis.summary_cn}`);
				}
				console.log(`   Category: ${analysis.category}`);
				processedCount++;
			}

			// Add delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
		} catch (error) {
			console.error(`Error processing article ${article.id}:`, error);
			errorCount++;
			// Continue with next article
		}
	}

	console.log(`\n📊 Processing Summary:`);
	console.log(`   Total articles in timeframe: ${articles.length}`);
	console.log(`   Articles needing processing: ${articlesToProcess.length}`);
	console.log(`   Successfully processed: ${processedCount}`);
	console.log(`   Errors: ${errorCount}`);
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log('🤖 Article AI Analysis Worker started');

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		try {
			await processUntaggedArticles(supabase, env);
			console.log('✅ Article AI Analysis Worker completed successfully');
		} catch (error) {
			console.error('❌ Article AI Analysis Worker failed:', error);
			throw error; // Re-throw to ensure Cloudflare logs the failure
		}
	},

	// Optional: HTTP endpoint for manual triggering
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/process' && request.method === 'POST') {
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

			ctx.waitUntil(processUntaggedArticles(supabase, env));

			return new Response(
				JSON.stringify({
					status: 'started',
					message: 'Article processing started',
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		return new Response('OpenNews Article AI Analysis Worker\n\nPOST /process - Manually trigger processing', {
			headers: { 'Content-Type': 'text/plain' },
		});
	},
};
