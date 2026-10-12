import http from "http";

const testPayload = JSON.stringify({
  update_id: 999999,
  message: {
    message_id: 1,
    from: { id: 12345678, is_bot: false, first_name: "Tester" },
    chat: { id: 12345678, type: "private" },
    date: Math.floor(Date.now() / 1000),
    text: "/start",
  },
});

const req = http.request(
  {
    hostname: "localhost",
    port: 3000,
    path: "/api/telegram/webhook",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(testPayload),
      "x-telegram-bot-api-secret-token": "your_secret_webhook_token_heresd",
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`BODY: ${body}`);
      process.exit(0);
    });
  }
);

req.on("error", (err) => {
  console.error("Test request failed:", err);
  process.exit(1);
});

req.write(testPayload);
req.end();
