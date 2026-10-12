import https from "https";

const token = process.env.TELEGRAM_BOT_TOKEN || "8950342083:AAFRorELVCZ_oUrkUCEppqmi4snagYLLML4";

// 1x1 transparent PNG buffer
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Test FormData sending to sendPhoto
const formData = new FormData();
formData.append("chat_id", "12345678"); // dummy chat ID to see Telegram API response structure
const blob = new Blob([new Uint8Array(tinyPng)], { type: "image/png" });
formData.append("photo", blob, "test.png");

fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
  method: "POST",
  body: formData,
})
  .then((res) => res.json())
  .then((data) => {
    console.log("SENDPHOTO RESPONSE:", data);
  })
  .catch((err) => {
    console.error("SENDPHOTO FETCH ERROR:", err);
  });
