import * as twitterText from 'twitter-text';

// 測試 twitter-text 功能
const testTexts = [
	'這是一個測試推文 #AI #科技',
	'OpenAI 發布新模型！這將改變AI產業的未來走向 🚀 #OpenAI #AI #科技突破',
	'Test mixed content: 中文English123 #hashtag @mention',
	'https://example.com/very-long-url-that-twitter-will-shorten',
];

console.log('=== Letter Count Test ===');
testTexts.forEach((text, index) => {
	const parsed = twitterText.parseTweet(text);
	const charCount = parsed.weightedLength;
	console.log(`${index + 1}. "${text}"`);
	console.log(`   字符數: ${charCount}`);
	console.log(`   字符串長度: ${text.length}`);
	console.log('');
});

// 測試 Twitter URL 縮短後的計算
const sampleTweet = '這是一個測試推文，包含連結和 hashtag #AI #科技';
const sampleUrl = 'https://example.com/article-url';
const twitterUrlLength = 23; // Twitter 自動縮短 URL 的長度

const tweetWithUrl = `${sampleTweet}\n\n${sampleUrl}`;
const sampleParsed = twitterText.parseTweet(sampleTweet);
const tweetWithUrlParsed = twitterText.parseTweet(tweetWithUrl);

console.log('=== Twitter URL Test ===');
console.log(`推文內容: "${sampleTweet}"`);
console.log(`推文字符數: ${sampleParsed.weightedLength}`);
console.log(`完整推文: "${tweetWithUrl}"`);
console.log(`完整推文字符數: ${tweetWithUrlParsed.weightedLength}`);
console.log(`是否符合 280 字符限制: ${tweetWithUrlParsed.weightedLength <= 280 ? '✅' : '❌'}`);
console.log(`推文有效性: ${tweetWithUrlParsed.valid ? '✅' : '❌'}`);