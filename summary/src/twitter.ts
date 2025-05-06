import twitterText from 'twitter-text';

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

export function splitContentIntoTweets(content: string, maxLength = 280): string[] {
	const finalTweets: string[] = [];
	const paragraphs = content.split(/\n\n+/).filter((p) => p.trim() !== '');

	console.log(`Splitting content into paragraphs. Total paragraphs: ${paragraphs.length}`);

	for (let i = 0; i < paragraphs.length; i++) {
		let currentTweet: string = paragraphs[i];
		let parsedCurrent = twitterText.parseTweet(currentTweet);

		if (parsedCurrent.weightedLength > maxLength) {
			// 處理單一段落超長的情況 例如：截斷、報錯、或者直接推送（如果業務邏輯允許）
			console.warn(`Warning: Single paragraph is too long. Weighted length: ${parsedCurrent.weightedLength}\nContent: ${currentTweet}`);
			finalTweets.push(currentTweet); // 或者采取其他措施
			continue;
		}

		while (i + 1 < paragraphs.length) {
			const nextParagraph = paragraphs[i + 1];
			const potentialTweet = currentTweet + '\n' + nextParagraph;
			const parsedPotential = twitterText.parseTweet(potentialTweet);

			// 檢查合併後的推文是否有效，並且加權長度不超過限制
			if (parsedPotential.valid && parsedPotential.weightedLength <= maxLength) {
				currentTweet = potentialTweet;
				i++; // 成功合併，移動到下一個段落
			} else {
				// 如果合併後超長或無效，則停止合併當前推文
				break;
			}
		}
		const finalParsedTweet = twitterText.parseTweet(currentTweet);
		console.log(`Tweet generated: weightedLength:${finalParsedTweet.weightedLength}, valid:${finalParsedTweet.valid}\n${currentTweet}`);
		finalTweets.push(currentTweet);
	}

	return finalTweets;
}

async function postSingleTweet(text: string, token: string, inReplyToId?: string): Promise<string> {
	const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
	if (inReplyToId) {
		payload.reply = { in_reply_to_tweet_id: inReplyToId };
	}

	console.log('Posting tweet payload:', payload);

	let response: Response;
	try {
		response = await fetch('https://api.twitter.com/2/tweets', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
	} catch (networkErr) {
		throw new Error(`Network error while contacting Twitter: ${String(networkErr)}`);
	}

	let responseBody: {
		title?: string;
		detail?: string;
		data?: { id?: string };
	};

	try {
		responseBody = (await response.json()) as typeof responseBody;
	} catch (parseErr) {
		const responseText = await response.text().catch(() => 'Could not read response text');
		throw new Error(
			`Could not parse Twitter response JSON: ${String(parseErr)}. Response status: ${response.status}, text: ${responseText}`
		);
	}

	const tweetId = responseBody?.data?.id;
	console.log('Twitter response status:', response.status, 'body:', responseBody);
	if (!response.ok || !tweetId) {
		throw new Error(
			`Tweet posting failed or no ID returned. Status: ${response.status}, Title: ${responseBody?.title}, Detail: ${responseBody?.detail}`
		);
	}

	return tweetId;
}

export async function postThread(env: Env, content: string): Promise<string[]> {
	const ACCESS_TOKEN = await getValidAccessToken(env);
	if (!ACCESS_TOKEN) {
		throw new Error('Failed to obtain a valid Twitter access token for posting thread.');
	}

	if (!content?.trim()) {
		throw new Error('postThread called with empty content.');
	}

	const threads = splitContentIntoTweets(content);
	console.log(`Splitting content into ${threads.length} tweet(s).`);

	let replyToId: string | undefined;
	const tweetIds: string[] = [];

	for (let i = 0; i < threads.length; i++) {
		const text = threads[i]; // Use directly from splitContentIntoTweets
		console.log(`Posting tweet ${i + 1}/${threads.length} replying to ${replyToId || 'N/A'}: \n"${text}"`);
		try {
			const tweetId = await postSingleTweet(text, ACCESS_TOKEN, replyToId);
			console.log(`Tweet ${i + 1} posted successfully. ID: ${tweetId}`);
			tweetIds.push(tweetId);
			replyToId = tweetId;

			if (i < threads.length - 1) {
				await new Promise((res) => setTimeout(res, 1000)); // Delay between tweets
			}
		} catch (err) {
			console.error(`Failed to post tweet ${i + 1}:`, err);
			throw err;
		}
	}

	console.log('Thread posted successfully!');
	return tweetIds;
}

/// --- Twitter Token Management ---

export async function getValidAccessToken(env: Env): Promise<string> {
	const ACCESS_TOKEN = await env.TWITTER_KV.get('ACCESS_TOKEN');
	console.log('Cached Access Token from KV:', ACCESS_TOKEN ? 'Found' : 'Not Found/Expired');

	if (ACCESS_TOKEN) {
		return ACCESS_TOKEN;
	}

	console.log('Bearer Token not found in KV or expired, attempting refresh.');
	return await refreshTwitterTokens(env);
}

async function refreshTwitterTokens(env: Env): Promise<string> {
	const REFRESH_TOKEN = await env.TWITTER_KV.get('REFRESH_TOKEN');
	const client_id = env.TWITTER_CLIENT_ID;
	const client_secret = env.TWITTER_CLIENT_SECRET;

	if (!REFRESH_TOKEN) {
		throw new Error('No Twitter REFRESH_TOKEN found in KV');
	}

	const params = new URLSearchParams();
	params.append('refresh_token', REFRESH_TOKEN);
	params.append('grant_type', 'refresh_token');
	params.append('client_id', client_id); // Client ID is in the body as per user's cURL
	const authHeader = 'Basic ' + btoa(`${client_id}:${client_secret}`);

	console.log(`Attempting to refresh Twitter token using the existing refresh_token...\nRequest body:${params.toString()}`);

	const res = await fetch('https://api.x.com/2/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: authHeader,
		},
		body: params.toString(),
	});

	if (!res.ok) {
		const errorText = await res.text().catch(() => 'Could not read error response body');
		console.error(`Failed to refresh Twitter access token. Status: ${res.status}, Response: ${errorText}`);
		if (res.status === 400 || res.status === 401) {
			// Bad request or Unauthorized
			console.log('Refresh token might be invalid or revoked. Clearing it from KV to prevent loops.');
			await env.TWITTER_KV.delete('BEARER_TOKEN');
		}
		throw new Error(`Failed to refresh Twitter access token: ${res.status} ${res.statusText} - ${errorText}`);
	}

	const data = (await res.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		token_type?: string;
	};

	const newAccessToken = data.access_token;
	const newRefreshToken = data.refresh_token;
	const expiresIn = data.expires_in || 3600;

	if (!newAccessToken || data.token_type?.toLowerCase() !== 'bearer') {
		console.error('Refresh response did not include a valid bearer access_token:', data);
		throw new Error('Failed to obtain new valid access token from refresh response.');
	}

	console.log('New Twitter Access Token obtained. Caching with expiration (seconds):', expiresIn);
	await env.TWITTER_KV.put('ACCESS_TOKEN', newAccessToken, { expirationTtl: expiresIn });

	if (newRefreshToken) {
		console.log('New Twitter Refresh Token also obtained. Updating in KV.');
		await env.TWITTER_KV.put('REFRESH_TOKEN', newRefreshToken);
	}

	return newAccessToken;
}
