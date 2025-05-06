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

function splitContentIntoTweets(content: string, maxLength = 180): string[] {
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
				continue;
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
	const BearerToken = await getValidBearerToken(env);
	if (!BearerToken) {
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
			const tweetId = await postSingleTweet(text, BearerToken, replyToId);
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

export async function getValidBearerToken(env: Env): Promise<string> {
	const BearerToken = await env.TWITTER_KV.get('BEARER_TOKEN');
	console.log('Cached Access Token from KV:', BearerToken ? 'Found' : 'Not Found/Expired');

	if (BearerToken) {
		return BearerToken;
	}

	console.log('Bearer Token not found in KV or expired, attempting refresh.');
	return await refreshTwitterTokens(env);
}

async function refreshTwitterTokens(env: Env): Promise<string> {
	const BearerToken = await env.TWITTER_KV.get('BEARER_TOKEN');
	console.log('Retrieved Refresh Token from KV for refresh attempt:', BearerToken ? 'Found' : 'Not Found');

	if (!BearerToken) {
		throw new Error(
			'No Twitter BearerToken found in KV. Re-authentication may be required. Ensure initial login stores TWITTER_REFRESH_TOKEN_KV_KEY.'
		);
	}

	const params = new URLSearchParams();
	params.append('refresh_token', BearerToken);
	params.append('grant_type', 'refresh_token');
	params.append('client_id', env.TWITTER_CLIENT_ID);

	console.log('Attempting to refresh Twitter token using refresh_token.');

	const authHeader = 'Basic ' + btoa(env.TWITTER_CLIENT_ID + ':' + env.TWITTER_CLIENT_SECRET);

	const res = await fetch('https://api.twitter.com/2/oauth2/token', {
		// Corrected endpoint
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
	await env.TWITTER_KV.put('BEARER_TOKEN', newAccessToken, { expirationTtl: expiresIn });

	if (newRefreshToken) {
		console.log('New Twitter Refresh Token also obtained. Updating in KV.');
		await env.TWITTER_KV.put('BEARER_TOKEN', newRefreshToken);
	}

	return newAccessToken;
}
