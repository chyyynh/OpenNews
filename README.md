# OpenNews

[Website Demo](https://open-news-psi.vercel.app/) | [Telegram Link](https://t.me/OpenNews_bot)

A crypto news Telegram bot that lets users choose what they care about — from specific tokens to niche sectors like DeFi, NFTs, or onchain gaming.

support RSS & websocket, frontend including web & tgbot

## Feature

### Front End

- login with supabase auth
- get twitter post with custom prompt and send to twitter

### CF Worker

1. rss-feed-monitor: monitor RSS link every 5 min
2. summary: summary by AI and send to twitter/telegram, X access token auto refresh, send summary to twitter by oauth2 access token
3. telegram-bot: tg bot server for selecting news topics
