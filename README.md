# OpenNews

[Website Demo](https://open-news-psi.vercel.app/) | [Telegram Link](https://t.me/OpenNews_bot) | [Twitter Demo](https://x.com/artofcryptowar)

A crypto news Telegram bot that lets users choose what they care about — from specific tokens to niche sectors like DeFi, NFTs, or onchain gaming.

support RSS & websocket, frontend including web & tgbot

## Feature

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
