import https from "https";

const token = process.env.TELEGRAM_BOT_TOKEN || "8950342083:AAFRorELVCZ_oUrkUCEppqmi4snagYLLML4";
const url = "https://ascent-sway-recycler.ngrok-free.dev/api/telegram/webhook";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "your_secret_webhook_token_heresd";

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
