const TWITTER_API_ENDPOINT = 'https://api.twitter.com/2/tweets';

function splitContentIntoTweets(content: string, maxLength = 280): string[] {
	const lines = content.split('\n').filter((line) => line.trim() !== '');
	const chunks: string[] = [];
	let current = '';

	for (const line of lines) {
		const next = current ? current + '\n' + line : line;
		if (next.length + 5 <= maxLength) {
			current = next;
		} else {
			if (current) chunks.push(current);
			current = line;
		}
	}

	if (current) chunks.push(current);
	return chunks;
}

async function postSingleTweet(text: string, token: string, inReplyToId?: string): Promise<string> {
	const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
	if (inReplyToId) {
		payload.reply = { in_reply_to_tweet_id: inReplyToId };
	}

	const response = await fetch(TWITTER_API_ENDPOINT, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const responseBody = (await response.json()) as {
		title?: string;
		detail?: string;
		data?: { id?: string };
	};

	if (!response.ok) {
		console.error('Twitter API Error:', responseBody);
		throw new Error(
			`Failed to post tweet. Status: ${response.status}. Error: ${responseBody.title || 'Unknown'}. Detail: ${
				responseBody.detail || 'No detail'
			}`
		);
	}

	const tweetId = responseBody?.data?.id;
	if (!tweetId) {
		throw new Error('Tweet posted but no ID returned.');
	}

	return tweetId;
}

export async function postThread(TWITTER_BEARER_TOKEN: string, content: string): Promise<string[]> {
	if (!TWITTER_BEARER_TOKEN) {
		console.error('BEARER Token is required.');
		return [];
	}

	if (!content?.trim()) {
		console.log('No content to post.');
		return [];
	}

	const rawTweets = splitContentIntoTweets(content);
	const total = rawTweets.length;
	const tweetsWithNumbering = rawTweets.map((text, i) => {
		const suffix = `\n${i + 1}/${total}`;
		// 如果太長就砍掉部分內容以保留 suffix
		if ((text + suffix).length > 280) {
			return text.slice(0, 280 - suffix.length) + suffix;
		}
		return text + suffix;
	});

	console.log(`Splitting content into ${total} tweet(s).`);

	let replyToId: string | undefined;
	const tweetIds: string[] = [];

	for (let i = 0; i < tweetsWithNumbering.length; i++) {
		const text = tweetsWithNumbering[i];
		console.log(`Posting tweet ${i + 1}/${total}: "${text.slice(0, 50)}..."`);
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
