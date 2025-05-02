// utils/twitter.ts - Cloudflare Worker Compatible Twitter Poster

/**
 * OAuth 1.0a 签名工具
 */
function percentEncode(str: string): string {
	return encodeURIComponent(str).replace(/[!*()']/g, (char) => '%' + char.charCodeAt(0).toString(16));
}

function generateNonce(length = 32): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let nonce = '';
	for (let i = 0; i < length; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}

async function getOAuth1Header({
	method,
	url,
	body,
	consumerKey,
	consumerSecret,
	accessToken,
	accessSecret,
}: {
	method: 'POST';
	url: string;
	body: string;
	consumerKey: string;
	consumerSecret: string;
	accessToken: string;
	accessSecret: string;
}): Promise<string> {
	const oauthParams = {
		oauth_consumer_key: consumerKey,
		oauth_nonce: generateNonce(),
		oauth_signature_method: 'HMAC-SHA1',
		oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
		oauth_token: accessToken,
		oauth_version: '1.0',
	};

	const baseParams = {
		...oauthParams,
	};

	const sortedParams = Object.entries(baseParams)
		.map(([k, v]) => [percentEncode(k), percentEncode(v)])
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `${k}=${v}`)
		.join('&');

	const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(sortedParams)].join('&');

	const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessSecret)}`;

	const keyData = new TextEncoder().encode(signingKey);
	const msgData = new TextEncoder().encode(baseString);
	const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
	const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
	const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

	return (
		'OAuth ' +
		Object.entries({
			...oauthParams,
			oauth_signature: signature,
		})
			.map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
			.join(', ')
	);
}

export async function postTweetThread({
	consumerKey,
	consumerSecret,
	accessToken,
	accessSecret,
	thread,
}: {
	consumerKey: string;
	consumerSecret: string;
	accessToken: string;
	accessSecret: string;
	thread: string[];
}) {
	let replyToId: string | undefined;

	for (const tweet of thread) {
		const url = 'https://api.twitter.com/2/tweets';
		const body = JSON.stringify(replyToId ? { text: tweet, reply: { in_reply_to_tweet_id: replyToId } } : { text: tweet });

		const authHeader = await getOAuth1Header({
			method: 'POST',
			url,
			body: '', // Twitter API v2 不需要 body 參與簽名，安全起見填空字串
			consumerKey,
			consumerSecret,
			accessToken,
			accessSecret,
		});

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: authHeader,
				'Content-Type': 'application/json',
			},
			body,
		});

		const data = (await res.json()) as { data: { id: string } };
		if (!res.ok) {
			throw new Error(`Tweet failed: ${JSON.stringify(data)}`);
		}

		replyToId = data.data.id;
	}
}
