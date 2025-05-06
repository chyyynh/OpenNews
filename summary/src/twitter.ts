const TWITTER_API_ENDPOINT = 'https://api.twitter.com/2/tweets';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	GEMINI_API_KEY: string;
	TWITTER_BEARER_TOKEN: string;
	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;
	TWITTER_KV: KVNamespace;
}

function splitContentIntoTweets(content: string, maxLength = 200): string[] {
	const contentWithoutNewlines = content.replace(/\r?\n/g, ' ');
	const words = contentWithoutNewlines.split(/\s+/).filter((word) => word.length > 0);

	const chunks: string[] = [];
	let currentChunkWords: string[] = [];
	const estimatedNumberingLength = 10;
	const effectiveMaxLength = maxLength - estimatedNumberingLength;

	for (const word of words) {
		const lengthIfAdded = currentChunkWords.join(' ').length + (currentChunkWords.length > 0 ? 1 : 0) + word.length;

		if (lengthIfAdded > effectiveMaxLength) {
			if (currentChunkWords.length > 0) {
				chunks.push(currentChunkWords.join(' '));
				currentChunkWords = [];
			} else {
				chunks.push(word);
				currentChunkWords = [];
				continue; // 處理下一個單詞
			}
			currentChunkWords.push(word);
		} else {
			currentChunkWords.push(word);
		}
	}

	if (currentChunkWords.length > 0) {
		chunks.push(currentChunkWords.join(' '));
	}

	const totalChunks = chunks.length;
	const numberedChunks = chunks.map((chunk, index) => {
		const numbering = ` ${index + 1}/${totalChunks}`;
		return chunk + numbering;
	});

	return numberedChunks;
}

async function postSingleTweet(text: string, token: string, inReplyToId?: string): Promise<string> {
	const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
	if (inReplyToId) {
		payload.reply = { in_reply_to_tweet_id: inReplyToId };
	}

	console.log('Posting tweet:', payload);

	let response: Response;
	try {
		response = await fetch(TWITTER_API_ENDPOINT, {
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
		throw new Error(`Could not parse Twitter response JSON: ${String(parseErr)}`);
	}

	const tweetId = responseBody?.data?.id;
	console.log('Twitter response:', responseBody);
	if (!tweetId) {
		throw new Error('Tweet posted but no ID returned.');
	}

	return tweetId;
}

export async function postThread(TWITTER_BEARER_TOKEN: string, content: string): Promise<string[]> {
	if (!TWITTER_BEARER_TOKEN) {
		throw new Error('TWITTER_BEARER_TOKEN is required but was empty.');
	}

	if (!content?.trim()) {
		throw new Error('postThread called with empty content.');
	}

	const threads = splitContentIntoTweets(content);
	const tweetsWithNumbering = threads.map((text, i) => {
		const suffix = `${i + 1}/${threads.length}`;
		if ((suffix + text).length > 280) {
			return text.slice(0, 280 - suffix.length) + suffix;
		}
		return suffix + text;
	});

	console.log(`Splitting content into ${threads.length} tweet(s).`);

	let replyToId: string | undefined;
	const tweetIds: string[] = [];

	for (let i = 0; i < tweetsWithNumbering.length; i++) {
		const text = tweetsWithNumbering[i];
		console.log(`Posting tweet ${i + 1}/${threads.length} replying ${replyToId}: \n"${text}" )`);
		try {
			const tweetId = await postSingleTweet(text, TWITTER_BEARER_TOKEN, replyToId);
			console.log(`Tweet ${i + 1} posted successfully. ID: ${tweetId}`);
			tweetIds.push(tweetId);
			replyToId = tweetId;

			if (i < tweetsWithNumbering.length - 1) {
				await new Promise((res) => setTimeout(res, 1000));
			}
		} catch (err) {
			console.error(`Failed to post tweet ${i + 1}:`, err);
			throw err;
		}
	}

	console.log('Thread posted successfully!');
	return tweetIds;
}

/// --- Twitter Bearer Token Management ---

export async function getValidBearerToken(env: Env): Promise<string> {
	const cached = await env.TWITTER_KV.get('BEARER_TOKEN');
	if (cached) return cached;
	return await refreshTwitterBearerToken(env);
}

async function refreshTwitterBearerToken(env: Env): Promise<string> {
	const params = new URLSearchParams();
	const BEARER_TOKEN = await env.TWITTER_KV.get('BEARER_TOKEN');
	if (!BEARER_TOKEN) {
		throw new Error('BEARER_TOKEN is null or undefined.');
	}
	params.append('refresh_token', BEARER_TOKEN);
	params.append('grant_type', 'refresh_token');
	params.append('client_id', env.TWITTER_CLIENT_ID);

	const res = await fetch('https://api.x.com/2/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params.toString(),
	});

	if (!res.ok) {
		const errorText = await res.text().catch(() => 'Could not read error response');
		throw new Error(`Failed to refresh Twitter access token: ${res.status} ${res.statusText} - ${errorText}`);
	}

	const data = (await res.json()) as { access_token: string; expires_in?: number };
	const newAccessToken = data.access_token;
	const expiresIn = data.expires_in || 3600;

	await env.TWITTER_KV.put('BEARER_TOKEN', newAccessToken, { expirationTtl: expiresIn });
	console.log('New Twitter Bearer token cached with expiration:', expiresIn);
	return newAccessToken;
}
