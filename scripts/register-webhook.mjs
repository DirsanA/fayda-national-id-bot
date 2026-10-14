import https from "https";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN environment variable is required.");
  process.exit(1);
}

// Allow passing the Vercel domain as a CLI argument: node scripts/register-webhook.mjs https://my-app.vercel.app
const targetBase = process.argv[2] || process.env.VERCEL_URL || "https://ascent-sway-recycler.ngrok-free.dev";
const baseUrl = targetBase.startsWith("http") ? targetBase : `https://${targetBase}`;
const url = `${baseUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "your_secret_webhook_token_heresd").trim();

console.log(`Setting Telegram webhook for bot to: ${url}`);

const postData = JSON.stringify({
  url: url,
  secret_token: secret,
  drop_pending_updates: false,
});

const req = https.request(
  {
    hostname: "api.telegram.org",
    path: `/bot${token}/setWebhook`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log("SET WEBHOOK RESULT:", body);

      // Verify webhook info
      https.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, (r2) => {
        let info = "";
        r2.on("data", (c) => (info += c));
        r2.on("end", () => {
          console.log("WEBHOOK INFO:", info);
        });
      });
    });
  }
);

req.on("error", (e) => {
  console.error("Error setting webhook:", e);
});

req.write(postData);
req.end();
