import { splitContentIntoTweets } from '../twitter'; // Assuming twitter.ts is in the same directory
import twitterText from 'twitter-text';

const testContent = `[summary] 13:20 - 14:50 UTC

主公！速報！

今日敵情詭譎，多方消息交織，需審慎應對。

**關鍵事件：** 美國穩定幣法案受阻，特朗普牽涉其中；市場整體下行；DogeOS、Canaan等項目獲得融資；21Shares推出Cronos相關ETP；Binance創辦人預測比特幣價格；VanEck擬推出BNB ETF；大量MOVE代幣轉入Binance；  美國參議員擬立法禁止總統主題Meme幣。

**涉及代幣：**  BNB, MOVE,  間接涉及SOL,  BTC。

**情報來源：** Cointelegraph, Coindesk, TechCrunch, BWENEWS。

**機遇與風險：**

* **機遇：**  BNB ETF申請，以及BNB價格預測，暗示BNB可能存在上漲潛力；SOL價格被機構大額購買，可能暗示其價值被看好；  部分項目獲得融資，也反映市場仍有活力。

* **風險：** 美國穩定幣法案受阻，以及針對總統主題Meme幣的立法，顯示監管風險加劇，市場恐將震盪；整體市場下行，投資需謹慎；  MOVE代幣大量轉入Binance，需觀察其後續市場表現及是否有操縱風險。


**結論：**  目前市場處於動盪期，監管風險與市場風險並存。  需密切關注美國監管動態及市場整體表現，  謹慎選擇投資標的，  方能立於不敗之地。  需進一步分析MOVE代幣流向及相關項目真實性，防範潛在風險。`;

function runTest() {
	console.log('--- Running splitContentIntoTweets Test ---');
	console.log('Original Content Length:', testContent.length);
	console.log('Original Content:\n', testContent);
	console.log('\n--- Splitting into Tweets (maxLength=280) ---');

	const tweets = splitContentIntoTweets(testContent);

	if (tweets.length === 0) {
		console.log('No tweets were generated.');
	} else {
		tweets.forEach((tweet: string, index: number) => {
			console.log(`\nTweet ${index + 1}/${tweets.length} (weightedLength: ${twitterText.parseTweet(tweet).weightedLength}):`);
			console.log(tweet);
			if (tweet.length > 280) {
				console.warn(`WARNING: Tweet ${index + 1} exceeds 280 characters! Length: ${tweet.length}`);
			}
		});
	}
	console.log('\n--- Test Finished ---');
}

runTest();
