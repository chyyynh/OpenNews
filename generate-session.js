// generate-session.js
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");

const apiId = 12345678; // 替換為你的 api_id（數字）
const apiHash = ""; // 替換為你的 api_hash（字串）
const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

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
