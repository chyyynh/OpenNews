// generate-session.js
require("dotenv").config();

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID; // 替換為你的 api_id（數字）
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH; // 替換為你的 api_hash（字串）
const client = new TelegramClient(
  new StringSession(""),
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  {
    connectionRetries: 5,
  }
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function generateSession() {
  await client.start({
    phoneNumber: () =>
      new Promise((resolve) =>
        rl.question("Enter your phone number: ", resolve)
      ),
    password: () =>
      new Promise((resolve) =>
        rl.question("Enter your password (if any): ", resolve)
      ),
    phoneCode: () =>
      new Promise((resolve) =>
        rl.question("Enter the code you received: ", resolve)
      ),
    onError: (err) => console.error(err),
  });
  const session = client.session.save();
  console.log("Your session string:", session);
  await client.disconnect();
  process.exit(0);
}

generateSession();
