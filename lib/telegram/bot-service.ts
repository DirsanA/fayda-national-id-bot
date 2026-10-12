import { mapFaydaJsonResponseToIdData } from "@/lib/fayda-mapper";
import {
  renderFrontCardBuffer,
  renderBackCardBuffer,
  renderCombinedCardBuffer,
} from "@/lib/telegram/card-renderer";
import {
  getSession,
  updateSession,
  clearSessionData,
  checkRateLimit,
  acquireUserLock,
  releaseUserLock,
} from "@/lib/telegram/session-store";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const FAYDA_BASE_URL = "https://otp.affiliate.pro.et/api/v1";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in .env");
  }
  return token;
}

function getFaydaApiKey(): string {
  const key = process.env.FAYDA_API_KEY || "";
  if (!key) {
    throw new Error("FAYDA_API_KEY is not configured in .env");
  }
  return key;
}

export const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "🪪 Print ID Card" }, { text: "💰 Check Balance" }],
    [{ text: "❓ Help" }, { text: "❌ Cancel" }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// Check Fayda Balance
async function fetchFaydaBalance(): Promise<any> {
  const apiKey = getFaydaApiKey();
  const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });
  return res.json().catch(() => null);
}

// Resilient fetch helper with timeout and retries for unreliable Telegram/ISP network connections
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, timeoutMs = 25000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      const isTimeout = err?.name === "AbortError" || err?.code === "UND_ERR_CONNECT_TIMEOUT";
      console.warn(`[Network] Attempt ${attempt}/${maxRetries} failed (${isTimeout ? "Timeout" : err?.message}). Retrying...`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

// Low-level Telegram API helper: sendMessage
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  extra: Record<string, any> = {}
) {
  try {
    const token = getBotToken();
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...extra,
      }),
    });
    return await res.json().catch(() => null);
  } catch (err) {
    console.error(`[Telegram sendMessage failed to chat ${chatId}]:`, err);
    return null;
  }
}

// Low-level Telegram API helper: sendPhoto
export async function sendTelegramPhoto(
  chatId: number,
  photoBuffer: Buffer,
  filename: string,
  caption?: string
) {
  const token = getBotToken();
  const formData = new FormData();
  formData.append("chat_id", String(chatId));

  const blob = new Blob([new Uint8Array(photoBuffer)], { type: "image/png" });
  formData.append("photo", blob, filename);

  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");
  }

  try {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
      method: "POST",
      body: formData,
    }, 3, 35000);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      console.error(`[Telegram sendPhoto Error] HTTP ${res.status}:`, data);
    }
    return data;
  } catch (photoErr) {
    console.error(`[Telegram sendPhoto Network Error]:`, photoErr);
    return null;
  }
}

// Low-level Telegram API helper: sendDocument (Sends uncompressed PNG file for crisp printing)
export async function sendTelegramDocument(
  chatId: number,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
) {
  const token = getBotToken();
  const formData = new FormData();
  formData.append("chat_id", String(chatId));

  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/png" });
  formData.append("document", blob, filename);

  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");
  }

  try {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    }, 3, 35000);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      console.error(`[Telegram sendDocument Error] HTTP ${res.status}:`, data);
    }
    return data;
  } catch (docErr) {
    console.error(`[Telegram sendDocument Network Error]:`, docErr);
    return null;
  }
}

// Send chat action (e.g. typing, upload_photo, or upload_document)
export async function sendTelegramAction(
  chatId: number,
  action: "typing" | "upload_photo" | "upload_document"
) {
  try {
    const token = getBotToken();
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Ignore non-fatal action errors
  }
}

// Handle Fayda API: Send OTP
async function requestFaydaOtp(fanNumber: string) {
  const apiKey = getFaydaApiKey();
  const cleanedFan = fanNumber.replace(/\s+/g, "");

  const res = await fetch(`${FAYDA_BASE_URL}/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ fanNumber: cleanedFan }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Fayda API error (status ${res.status})`);
  }
  return data;
}

// Handle Fayda API: Verify OTP
async function verifyFaydaOtp(otp: string, fanNumber: string, session: string) {
  const apiKey = getFaydaApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${FAYDA_BASE_URL}/verify-otp-json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        otp: String(otp).trim(),
        fanNumber: String(fanNumber).replace(/\s+/g, ""),
        session,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || `Verification failed (status ${res.status})`);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Verification timed out after 120 seconds. Please try again.");
    }
    throw err;
  }
}

// Main Telegram Update Handler
export async function handleTelegramUpdate(update: any) {
  const message = update?.message || update?.edited_message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userId = message.from?.id || chatId;
  const text = message.text.trim();

  // Basic abuse / rate limiting protection
  if (!checkRateLimit(userId)) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Too many requests. Please wait a moment before sending another message."
    );
    return;
  }

  // Handle Global Cancel Command anytime
  if (text === "/cancel" || text === "❌ Cancel") {
    clearSessionData(userId);
    releaseUserLock(userId);
    await sendTelegramMessage(
      chatId,
      "Verification session cancelled. Tap *🪪 Print ID Card* whenever you are ready.",
      { reply_markup: MAIN_MENU_KEYBOARD }
    );
    return;
  }

  // Handle Help Command
  if (text === "/help" || text === "❓ Help") {
    await sendTelegramMessage(
      chatId,
      "ℹ️ *Menu & Commands:*\n\n" +
        "• *🪪 Print ID Card* (`/start`) - Verify FAN and generate print-ready ID cards\n" +
        "• *💰 Check Balance* (`/balance`) - View remaining Fayda API verification points\n" +
        "• *❌ Cancel* (`/cancel`) - Cancel current active session\n" +
        "• *❓ Help* (`/help`) - View this help message\n\n" +
        "You can tap the buttons at the bottom of your screen anytime!",
      { reply_markup: MAIN_MENU_KEYBOARD }
    );
    return;
  }

  // Handle Balance Command
  if (text === "/balance" || text === "💰 Check Balance") {
    await sendTelegramAction(chatId, "typing");
    try {
      const balanceData = await fetchFaydaBalance();
      const points =
        balanceData?.remainingPoints ??
        balanceData?.balance ??
        balanceData?.points ??
        "N/A";
      await sendTelegramMessage(
        chatId,
        `💰 *Fayda API Balance:*\n\nYour current account balance is: *${points}* points.`,
        { reply_markup: MAIN_MENU_KEYBOARD }
      );
    } catch {
      await sendTelegramMessage(
        chatId,
        "⚠️ Unable to retrieve balance right now. Please check your Fayda API configuration.",
        { reply_markup: MAIN_MENU_KEYBOARD }
      );
    }
    return;
  }

  // Acquire concurrency lock per user
  if (!acquireUserLock(userId)) {
    console.log(`[Bot] Concurrent request blocked for user ${userId}.`);
    // Silently ignore rapid repeated clicks or updates while lock is held
    return;
  }

  try {
    const session = getSession(userId, chatId);
    const isStartCmd = text === "/start" || text === "/restart" || text === "🪪 Print ID Card";

    // 1. Handle "Print ID Card" / /start safely & idempotently
    if (isStartCmd) {
      if (session.state === "WAITING_FOR_FAN") {
        // User already in FAN entry state: do not resend identical prompt
        console.log(`[Bot] User ${userId} tapped Print ID Card while already in WAITING_FOR_FAN. Ignored.`);
        return;
      }

      if (
        session.state === "REQUESTING_OTP" ||
        session.state === "VERIFYING_OTP" ||
        session.state === "GENERATING_CARD"
      ) {
        // Operation is currently running: never cancel or restart
        await sendTelegramMessage(
          chatId,
          "⏳ Your request is already being processed. Please wait..."
        );
        return;
      }

      if (session.state === "WAITING_FOR_OTP") {
        // Inform user they are waiting for OTP, provide clean guidance
        await sendTelegramMessage(
          chatId,
          "📲 An OTP has already been sent to your phone. Please reply with the *6-digit OTP code*, or tap *❌ Cancel* to start over.",
          { reply_markup: MAIN_MENU_KEYBOARD }
        );
        return;
      }

      // Clean start transition to WAITING_FOR_FAN
      clearSessionData(userId);
      updateSession(userId, { state: "WAITING_FOR_FAN", chatId });

      await sendTelegramMessage(
        chatId,
        "🪪 *Fayda National ID Verification*\n\nPlease enter your *16-digit Fayda FAN number* (e.g. `4952 8025 7094 3927` or without spaces):",
        { reply_markup: MAIN_MENU_KEYBOARD }
      );
      return;
    }

    // 2. Validate current state transitions
    switch (session.state) {
      case "WAITING_FOR_FAN": {
        const cleanFan = text.replace(/[\s-]/g, "");

        if (!/^\d{16}$/.test(cleanFan)) {
          await sendTelegramMessage(
            chatId,
            "❌ *Invalid FAN Format*\n\nPlease enter a valid 16-digit FAN number (numbers only, e.g. `8029 5016 4312 4539`)."
          );
          return;
        }

        // Lock state to REQUESTING_OTP
        const reqId = `${Date.now()}-${Math.random()}`;
        updateSession(userId, { state: "REQUESTING_OTP", activeRequestId: reqId });

        await sendTelegramAction(chatId, "typing");
        await sendTelegramMessage(chatId, "⏳ Requesting OTP from Fayda system...");

        try {
          const otpResponse = await requestFaydaOtp(cleanFan);

          // Verify request is still active
          const current = getSession(userId, chatId);
          if (current.activeRequestId !== reqId) return;

          if (!otpResponse || !otpResponse.session) {
            throw new Error(otpResponse?.message || "Failed to initiate OTP request from Fayda.");
          }

          updateSession(userId, {
            state: "WAITING_FOR_OTP",
            fanNumber: cleanFan,
            faydaSession: otpResponse.session,
            phone: otpResponse.phone || "",
            activeRequestId: undefined,
          });

          const phoneInfo = otpResponse.phone ? ` to registered phone *${otpResponse.phone}*` : "";
          await sendTelegramMessage(
            chatId,
            `📲 An OTP code has been sent${phoneInfo}.\n\nPlease reply with the *6-digit OTP code*:`
          );
        } catch (err) {
          updateSession(userId, { state: "WAITING_FOR_FAN", activeRequestId: undefined });
          const errMsg = err instanceof Error ? err.message : "Error contacting Fayda server";
          await sendTelegramMessage(
            chatId,
            `❌ *Error Requesting OTP:*\n${errMsg}\n\nPlease check your FAN number and try again, or tap *❌ Cancel* to stop.`
          );
        }
        break;
      }

      case "REQUESTING_OTP": {
        // User sent duplicate FAN or other message while OTP request is in flight
        console.log(`[Bot] User ${userId} sent message while in REQUESTING_OTP. Ignored.`);
        break;
      }

      case "WAITING_FOR_OTP": {
        const cleanOtp = text.replace(/[\s-]/g, "");

        if (!/^\d{6}$/.test(cleanOtp)) {
          await sendTelegramMessage(
            chatId,
            "❌ *Invalid OTP Format*\n\nPlease enter the *6-digit* verification code sent to your phone (numbers only, e.g. `123456`)."
          );
          return;
        }

        if (!session.fanNumber || !session.faydaSession) {
          clearSessionData(userId);
          await sendTelegramMessage(
            chatId,
            "⚠️ Your verification session has expired. Tap *🪪 Print ID Card* to begin a new session.",
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
          return;
        }

        // Lock state to VERIFYING_OTP with unique request token
        const reqId = `${Date.now()}-${Math.random()}`;
        updateSession(userId, { state: "VERIFYING_OTP", activeRequestId: reqId });

        await sendTelegramMessage(
          chatId,
          "⏳ Verifying OTP with Fayda government service... (This may take up to 30 seconds)"
        );

        // Keep chat action active every 4.5s so user sees bot is alive and doesn't send duplicate OTPs
        let actionType: "typing" | "upload_document" = "typing";
        const actionTimer = setInterval(() => {
          sendTelegramAction(chatId, actionType).catch(() => {});
        }, 4500);
        sendTelegramAction(chatId, "typing").catch(() => {});

        try {
          console.log(`[Bot] Verifying OTP for user ${userId}...`);
          const verifyResponse = await verifyFaydaOtp(
            cleanOtp,
            session.fanNumber,
            session.faydaSession
          );

          // Verify request is still active
          const current = getSession(userId, chatId);
          if (current.activeRequestId !== reqId) {
            clearInterval(actionTimer);
            return;
          }

          if (!verifyResponse?.success || !verifyResponse?.data) {
            throw new Error(verifyResponse?.message || "Verification failed. Please check the OTP.");
          }

          // Advance state to GENERATING_CARD
          updateSession(userId, { state: "GENERATING_CARD" });
          actionType = "upload_document";

          // Map data using existing mapper
          console.log(`[Bot] Mapping Fayda response data...`);
          const idData = mapFaydaJsonResponseToIdData(verifyResponse.data);

          await sendTelegramMessage(
            chatId,
            `✅ *Verification Successful!* \n👤 *Name:* ${idData.fullNameEnglish} (${idData.fullNameAmharic})\n\nGenerating your high-resolution Front & Back cards...`
          );

          // Render single combined card image (Front Left, Back Right, Zero paper background, 300 DPI, Original Color Photo)
          console.log(`[Bot] Rendering combined side-by-side card buffer (Color)...`);
          const combinedBuf = await renderCombinedCardBuffer(idData, "color");
          console.log(`[Bot] Combined card buffer generated: ${combinedBuf.length} bytes`);

          // Send high-resolution combined PNG directly as a downloadable document
          const docRes = await sendTelegramDocument(
            chatId,
            combinedBuf,
            `fayda-id-card-${idData.finNumber || "card"}.png`,
            `🪪 *Ethiopian National ID Card (Front & Back)*\n👤 *${idData.fullNameEnglish}* (${idData.fullNameAmharic})\nFIN: \`${idData.finNumber || "N/A"}\`\n\n✅ _High-resolution (300 DPI) print-ready file. Zero document margins._`
          );
          console.log(`[Bot] Document sent result:`, docRes?.ok ? "OK" : JSON.stringify(docRes));

          clearInterval(actionTimer);

          // Clean session state for user so they can start fresh anytime
          clearSessionData(userId);

          await sendTelegramMessage(
            chatId,
            "🎉 *All done!* Your ID card has been delivered. Tap *🪪 Print ID Card* if you need to verify another ID.",
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
        } catch (err) {
          clearInterval(actionTimer);
          console.error(`[Bot] Verification error for user ${userId}:`, err);
          // Recoverable state back to WAITING_FOR_OTP so user can re-try OTP code
          updateSession(userId, { state: "WAITING_FOR_OTP", activeRequestId: undefined });
          const errMsg = err instanceof Error ? err.message : "Verification error occurred";
          await sendTelegramMessage(
            chatId,
            `❌ *Verification Failed:*\n${errMsg}\n\nPlease check your OTP code and try again, or tap *❌ Cancel* to start over.`,
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
        }
        break;
      }

      case "VERIFYING_OTP":
      case "GENERATING_CARD": {
        console.log(`[Bot] User ${userId} sent message while operation in progress. Ignored.`);
        break;
      }

      default: {
        await sendTelegramMessage(
          chatId,
          "Tap *🪪 Print ID Card* below or send `/start` to begin.",
          { reply_markup: MAIN_MENU_KEYBOARD }
        );
        break;
      }
    }
  } finally {
    releaseUserLock(userId);
  }
}
