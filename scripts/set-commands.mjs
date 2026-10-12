import https from "https";

const token = process.env.TELEGRAM_BOT_TOKEN || "8950342083:AAFRorELVCZ_oUrkUCEppqmi4snagYLLML4";

const commands = JSON.stringify({
  commands: [
    { command: "start", description: "Start Fayda ID Verification & Print" },
    { command: "balance", description: "Check remaining API points balance" },
    { command: "cancel", description: "Cancel current active session" },
    { command: "help", description: "Help and instructions" },
  ],
});

const req = https.request(
  {
    hostname: "api.telegram.org",
    path: `/bot${token}/setMyCommands`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(commands),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      console.log("SET COMMANDS RESULT:", body);
    });
  }
);

req.on("error", (e) => {
  console.error("Error setting bot commands:", e);
});

req.write(commands);
req.end();
