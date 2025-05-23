# OpenNews

[Website Demo](https://open-news-psi.vercel.app/) | [Telegram Link](https://t.me/OpenNews_bot) | [Twitter Demo](https://x.com/artofcryptowar)

A crypto news Telegram bot that lets users choose what they care about — from specific tokens to niche sectors like DeFi, NFTs, or onchain gaming.

support RSS & websocket, frontend including web & tgbot

## Feature

### AI Tagging Prompt

```
		You are a crypto-native research analyst. Please analyze the following piece of crypto news and classify it into one or more of the following categories based on its content.

		!Important:
		- Only return the main category name listed before any slashes.
		- Do not include multiple category names in one string (e.g., use "Regulation", not "Regulation / Legal / Compliance").
		- Use only the standardized names listed below.

		## Standardized Categories (choose the most relevant ones, max 3):

		1. Layer1
		2. DeFi
		3. NFT
		4. GameFi
		5. Metaverse
		6. DAO
		7. Regulation
		8. Security
		9. Exchange
		10. Trading
		11. Fundraising
		12. Ecosystem
		13. Community
		14. ETF
		15. Listing

		Category Normalization Guide:

		- "Layer 1 / Layer 2 / Blockchain Infrastructure" → Layer1
		- "DeFi (Decentralized Finance)" → DeFi
		- "NFT / GameFi / Metaverse" → NFT, GameFi, or Metaverse (pick separately)
		- "DAO / Governance" → DAO
		- "Regulation / Legal / Compliance" → Regulation
		- "Hacks / Exploits / Scams / Security Incidents" → Security
		- "Centralized or Decentralized Exchanges (CEX / DEX)" → Exchange
		- "Talking about token price or technical analysis" → Trading
		- "Fundraising / Investments / Venture Capital" → Fundraising
		- "Ecosystem Growth (e.g., Solana, Ethereum, Cosmos, etc.)" → Ecosystem
		- "Community / Airdrops / Governance Proposals / Marketing Campaigns" → Community
		- "ETF (e.g., Spot or Futures-based Exchange Traded Funds)" → ETF
		- "Listings of tokens on exchanges (CEX or DEX)" → Listing

		News content:{{ ${title}\n\n${content} }}`
```

### Front End

- Login with Telegram Login Widget
- News Comment with custom prompt
- Support both Telegram Bot(including [mini app](https://core.telegram.org/bots/webapps#designing-mini-apps)) and Website

### CF Worker

1. rss-feed-monitor: monitor RSS link every 5 min
2. summary: summary by AI and send to twitter/telegram, X access token auto refresh, send summary to twitter by oauth2 access token
3. telegram-bot: tg bot server for selecting news topics

### System Diagram

![](https://www.mermaidchart.com/raw/ce8745bd-e9c3-4711-9dbe-636f96e9e14d?theme=light&version=v0.1&format=svg)
