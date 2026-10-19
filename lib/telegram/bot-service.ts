import { mapFaydaJsonResponseToIdData } from "@/lib/fayda-mapper";
import {
  renderFrontCardBuffer,
  renderBackCardBuffer,
  renderCombinedCardBuffer,
  CardTemplateId,
} from "@/lib/telegram/card-renderer";
import {
  getSession,
  updateSession,
  clearSessionData,
  checkRateLimit,
  acquireUserLock,
  releaseUserLock,
} from "@/lib/telegram/session-store";
import {
  findCustomerByTelegramId,
  adjustCustomerBalance,
  recordCustomerVerificationUsage,
  upsertCustomer,
  updateCustomerCardTemplate,
} from "@/lib/models/customer";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const FAYDA_BASE_URL = "https://otp.affiliate.pro.et/api/v1";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in .env");
  }
  return token;
}

function getDefaultFaydaApiKey(): string {
  const key = process.env.FAYDA_API_KEY || "";
  if (!key) {
    throw new Error("FAYDA_API_KEY is not configured in .env");
  }
  return key;
}

function getAdminTelegramChatId(): string | number | null {
  // Prefer ADMIN_TELEGRAM_ID, fallback to ADMIN_TELEGRAM_CHAT_ID, then default
  const envVal = (process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || "").trim();
  if (envVal) return envVal;
  // Default admin ID as fallback
  return "1765940918";
}

interface PaymentConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  rateInfo: string;
  adminUsername: string;
  isConfigured: boolean;
}

function getPaymentConfig(): PaymentConfig {
  const bankName = (process.env.PAYMENT_BANK_NAME || process.env.PAYMENT_PROVIDER || "").trim();
  const accountNumber = (process.env.PAYMENT_ACCOUNT_NUMBER || process.env.PAYMENT_ACCOUNT_NO || "").trim();
  const accountHolder = (process.env.PAYMENT_ACCOUNT_HOLDER || process.env.PAYMENT_ACCOUNT_NAME || "").trim();
  const rateInfo = (process.env.PAYMENT_RATE_INFO || process.env.PAYMENT_RATE || "").trim();
  const adminUsername = (process.env.ADMIN_TELEGRAM_USERNAME || "Dirsan_A").trim().replace(/^@/, "");

  const isConfigured = Boolean(bankName && accountNumber && accountHolder);

  return {
    bankName,
    accountNumber,
    accountHolder,
    rateInfo,
    adminUsername,
    isConfigured,
  };
}

function buildRechargeInstructionsMessage(userId: number): string {
  const config = getPaymentConfig();
  const safeAdminUsername = config.adminUsername.replace(/[_*`\[\]]/g, "\\$&");

  if (!config.isConfigured) {
    return (
      "💳 *Account Recharge & Top‑up Instructions*\n\n" +
      "⚠️ *Payment account details are currently being configured by administration.*\n\n" +
      "Please contact our administrator directly to receive official payment details and pricing:\n\n" +
      `👤 *Admin Contact:* @${safeAdminUsername}\n` +
      `🆔 *Your Telegram User ID:* \`${userId}\`\n\n` +
      "📋 *How to complete your recharge:*\n" +
      `1. Send a message to @${safeAdminUsername} for payment details.\n` +
      "2. Transfer your desired amount.\n" +
      "3. Send your payment screenshot or PDF receipt directly into this chat anytime (you can include your paid amount in the caption).\n\n" +
      "⏳ Our team will manually verify the payment and credit your balance in the admin dashboard."
    );
  }

  const safeBankName = config.bankName.replace(/[_*`\[\]]/g, "\\$&");
  const safeAccountHolder = config.accountHolder.replace(/[_*`\[\]]/g, "\\$&");
  const safeRateInfo = config.rateInfo ? config.rateInfo.replace(/[_*`\[\]]/g, "\\$&") : "";

  let msg =
    "💳 *Account Recharge & Verification Top‑up*\n\n" +
    "To top up your Fayda ID verification balance, please transfer your payment using the details below:\n\n" +
    `🏦 *Payment Provider / Bank:* ${safeBankName}\n` +
    `👤 *Account Holder Name:* ${safeAccountHolder}\n` +
    `🔢 *Account Number:* \`${config.accountNumber}\` _(tap to copy)_\n`;

  if (safeRateInfo) {
    msg += `💵 *Rate / Pricing:* ${safeRateInfo}\n`;
  }

  msg +=
    "\n📋 *Next Steps:*\n" +
    "1. Transfer the desired payment amount to the account above.\n" +
    "2. Upload your payment screenshot or official PDF receipt directly into this chat anytime (you can mention the paid amount in the caption).\n" +
    "3. Our administration will verify the receipt and manually update your verification balance in the system.\n\n" +
    `💬 For any questions or instant confirmation, contact: @${safeAdminUsername}`;

  return msg;
}

function buildInsufficientBalanceMessage(userId: number): string {
  const config = getPaymentConfig();
  const safeAdminUsername = config.adminUsername.replace(/[_*`\[\]]/g, "\\$&");

  let msg =
    "⚠️ *Insufficient Balance*\n\n" +
    "Your verification balance is insufficient to print your ID card.\n\n" +
    "💳 *Please recharge your account to continue.*\n\n" +
    "Follow the payment instructions below and upload your payment receipt directly into this chat. Your payment will be reviewed manually.\n\n";

  if (!config.isConfigured) {
    const missingFields: string[] = [];
    if (!config.bankName) missingFields.push("Bank / Provider Name");
    if (!config.accountNumber) missingFields.push("Account Number");
    if (!config.accountHolder) missingFields.push("Account Holder Name");

    msg +=
      "⚠️ *Payment account details are currently not fully configured by administration.*\n" +
      `_(Missing configuration: ${missingFields.join(", ")})_\n\n` +
      "Please contact our administrator directly to receive official payment details and pricing:\n\n" +
      `👤 *Admin Contact:* @${safeAdminUsername}\n` +
      `🆔 *Your Telegram User ID:* \`${userId}\`\n\n` +
      "📋 *How to recharge:*\n" +
      `1. Send a message to @${safeAdminUsername} for payment details.\n` +
      "2. Transfer your desired amount.\n" +
      "3. Send your payment screenshot or PDF receipt directly into this chat anytime.";
  } else {
    const safeBankName = config.bankName.replace(/[_*`\[\]]/g, "\\$&");
    const safeAccountHolder = config.accountHolder.replace(/[_*`\[\]]/g, "\\$&");
    const safeRateInfo = config.rateInfo ? config.rateInfo.replace(/[_*`\[\]]/g, "\\$&") : "";

    msg +=
      `🏦 *Payment Provider / Bank:* ${safeBankName}\n` +
      `👤 *Account Holder Name:* ${safeAccountHolder}\n` +
      `🔢 *Account Number:* \`${config.accountNumber}\` _(tap to copy)_\n`;

    if (safeRateInfo) {
      msg += `💵 *Rate / Pricing:* ${safeRateInfo}\n`;
    }

    msg +=
      "\n📋 *Next Steps:*\n" +
      "1. Transfer your desired payment amount to the account above.\n" +
      "2. Send your payment screenshot or official PDF receipt directly into this chat anytime (you can include your paid amount in the caption).\n" +
      "3. Our administration will review your receipt and credit your balance manually.\n\n" +
      `💬 For questions or fast assistance: @${safeAdminUsername}`;
  }

  return msg;
}

export const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "🪪 Print ID Card" }, { text: "💰 Balance" }],
    [{ text: "🎨 Card Template" }, { text: "💳 Recharge (Upload Receipt)" }],
    [{ text: "❓ Help" }, { text: "❌ Cancel" }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// Check Fayda Provider Balance (uses shared server API key if none provided)
async function fetchFaydaBalance(apiKey?: string, timeoutMs = 10000): Promise<any> {
  const effectiveKey = (apiKey || getDefaultFaydaApiKey()).trim();
  if (!effectiveKey) {
    throw new Error("No Fayda API key configured on server.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
      method: "GET",
      headers: { "x-api-key": effectiveKey },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || `Provider balance request failed (HTTP ${res.status})`);
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new Error("Provider balance request timed out. Please try again.");
    }
    throw err;
  }
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

// Low-level Telegram API helper: answerCallbackQuery
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
) {
  try {
    const token = getBotToken();
    await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (err) {
    console.error(`[Telegram answerCallbackQuery failed]:`, err);
  }
}

// Low-level Telegram API helper: editMessageText (for updating loading messages in-place)
export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  extra: Record<string, any> = {}
) {
  try {
    const token = getBotToken();
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
        ...extra,
      }),
    });
    return await res.json().catch(() => null);
  } catch (err) {
    console.error(`[Telegram editMessageText failed to chat ${chatId}]:`, err);
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

// Handle Fayda API: Send OTP using shared server API key (or custom key if provided)
async function requestFaydaOtp(fanNumber: string, apiKey?: string) {
  const effectiveKey = (apiKey || getDefaultFaydaApiKey()).trim();
  if (!effectiveKey) {
    throw new Error("No Fayda API key configured on server.");
  }
  const cleanedFan = fanNumber.replace(/\s+/g, "");

  const res = await fetch(`${FAYDA_BASE_URL}/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": effectiveKey,
    },
    body: JSON.stringify({ fanNumber: cleanedFan }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Fayda API error (status ${res.status})`);
  }
  return data;
}

// Handle Fayda API: Verify OTP using shared server API key (or custom key if provided)
async function verifyFaydaOtp(otp: string, fanNumber: string, session: string, apiKey?: string) {
  const effectiveKey = (apiKey || getDefaultFaydaApiKey()).trim();
  if (!effectiveKey) {
    throw new Error("No Fayda API key configured on server.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${FAYDA_BASE_URL}/verify-otp-json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": effectiveKey,
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

// Helper to forward user payment screenshot to Admin Telegram
async function forwardPaymentScreenshotToAdmin(
  message: any,
  senderUserId: number,
  senderChatId: number
) {
  const adminChatId = getAdminTelegramChatId();
  const username = message.from?.username ? `@${message.from.username}` : "None";
  const firstName = message.from?.first_name || "";
  const lastName = message.from?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || "User";

  const token = getBotToken();

  // Escape Markdown characters in username/name to prevent formatting errors
  const safeFullName = fullName.replace(/[_*`\[\]]/g, "\\$&");
  const safeUsername = username.replace(/[_*`\[\]]/g, "\\$&");

  // Extract customer caption or claimed amount if provided
  const customerCaption = message.caption?.trim() || "";
  const safeCustomerCaption = customerCaption
    ? customerCaption.replace(/[_*`\[\]]/g, "\\$&")
    : "";

  // Caption with customer identification details and claimed amount
  let adminCaption =
    `🧾 *New Payment Receipt Received!*\n\n` +
    `👤 *Sender:* ${safeFullName} (${safeUsername})\n` +
    `🆔 *Telegram User ID:* \`${senderUserId}\`\n` +
    `💬 *Chat ID:* \`${senderChatId}\`\n`;

  if (safeCustomerCaption) {
    adminCaption += `💵 *Claimed Amount / Note:* ${safeCustomerCaption}\n`;
  } else {
    adminCaption += `💵 *Claimed Amount / Note:* _None provided_\n`;
  }

  adminCaption +=
    `⏰ *Time:* ${new Date().toLocaleString()}\n\n` +
    `_Please review the payment receipt and manually update the customer's balance in the admin dashboard._`;

  // Always respond to the customer first so they have immediate confirmation
  await sendTelegramMessage(
    senderChatId,
    "✅ *Payment receipt received!*\n\n" +
      "Your payment proof has been forwarded to our administration team for review.\n\n" +
      "Your verification balance will be updated once manually confirmed. Thank you!",
    { reply_markup: MAIN_MENU_KEYBOARD }
  );

  console.log(`[Screenshot Forward] Attempting forward to admin chat ${adminChatId} from user ${senderUserId}`);

  if (adminChatId) {
    try {
      // 1. First attempt: Copy the media message directly with the formatted caption
      const copyRes = await fetchWithRetry(
        `${TELEGRAM_API_BASE}/bot${token}/copyMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: Number(adminChatId),
            from_chat_id: senderChatId,
            message_id: message.message_id,
            caption: adminCaption,
            parse_mode: "Markdown",
          }),
        },
        3,
        30000
      );
      const copyData = await copyRes.json().catch(() => null);

      if (copyData?.ok) {
        console.log(`[Screenshot Forward] Successfully copied media and caption to admin chat ${adminChatId}`);
      } else {
        console.warn(`[Screenshot Forward] copyMessage with caption failed (${copyData?.description}), attempting copy without caption...`);

        // 2. Fallback: Copy media without caption, then send caption as a separate message
        const fallbackRes = await fetchWithRetry(
          `${TELEGRAM_API_BASE}/bot${token}/copyMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: Number(adminChatId),
              from_chat_id: senderChatId,
              message_id: message.message_id,
            }),
          },
          3,
          30000
        );
        const fallbackData = await fallbackRes.json().catch(() => null);

        if (fallbackData?.ok) {
          await sendTelegramMessage(
            Number(adminChatId),
            adminCaption,
            { parse_mode: "Markdown" }
          );
          console.log(`[Screenshot Forward] Successfully copied media and sent separate caption to admin chat ${adminChatId}`);
        } else {
          console.error(`[Screenshot Forward] copyMessage completely failed:`, fallbackData);
          // 3. Fallback: Notify admin via text message so the admin knows a payment was submitted
          await sendTelegramMessage(
            Number(adminChatId),
            `⚠️ *New Payment Receipt Notice*\n\nUser *${safeFullName}* (${safeUsername}) with ID \`${senderUserId}\` sent a payment screenshot/PDF, but forwarding the media file failed (${fallbackData?.description || "unknown error"}).\nClaimed note: ${safeCustomerCaption || "None"}\nPlease check the bot conversation directly.`
          );
        }
      }
    } catch (err) {
      console.error("[Screenshot Forward Error]:", err);
    }
  } else {
    console.warn(`[Screenshot Forward] ADMIN_TELEGRAM_ID is not configured in environment.`);
  }
}

// Main Telegram Update Handler
export async function handleTelegramUpdate(update: any) {
  // Support callback queries (e.g. from inline keyboard for template selection)
  if (update?.callback_query) {
    const cb = update.callback_query;
    const cbId = cb.id;
    const cbData = cb.data;
    const cbUserId = cb.from?.id;
    const cbChatId = cb.message?.chat?.id;

    if (cbData && cbData.startsWith("set_template:")) {
      const chosen = cbData.split(":")[1] as CardTemplateId;
      if (["template1", "template2", "template3"].includes(chosen)) {
        await updateCustomerCardTemplate(cbUserId, chosen).catch(() => null);
        updateSession(cbUserId, { cardTemplate: chosen });
        await answerTelegramCallbackQuery(cbId, `Selected ${chosen.toUpperCase()}`);

        const templateNames: Record<string, string> = {
          template1: "Template 1 (Classic Standard)",
          template2: "Template 2 (Modern Blue Header)",
          template3: "Template 3 (Compact Layout)",
        };

        if (cbChatId) {
          await sendTelegramMessage(
            cbChatId,
            `🎨 *Template Updated!*\n\nYour ID cards will now be rendered using *${templateNames[chosen] || chosen}*.\n\nTap *🪪 Print ID Card* to generate cards.`,
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
        }
      }
      return;
    }
  }

  const message = update?.message || update?.edited_message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from?.id || chatId;

  // Check if message contains a payment screenshot or PDF receipt (photo or image/pdf document)
  const isReceiptAttachment =
    (message.photo && message.photo.length > 0) ||
    (message.document &&
      (message.document.mime_type?.startsWith("image/") ||
        message.document.mime_type === "application/pdf" ||
        message.document.file_name?.match(/\.(png|jpe?g|webp|pdf)$/i)));

  if (isReceiptAttachment) {
    await forwardPaymentScreenshotToAdmin(message, userId, chatId);
    return;
  }

  if (!message.text) return;
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

  // Handle Global Recharge Command anytime (works from any screen/session state)
  const isRechargeCommand =
    text === "💳 Recharge (Upload Receipt)" ||
    text === "💳 Recharge" ||
    text.toLowerCase() === "/recharge" ||
    text.toLowerCase() === "/topup" ||
    text.toLowerCase().includes("recharge");

  if (isRechargeCommand) {
    clearSessionData(userId);
    releaseUserLock(userId);
    const rechargeMsg = buildRechargeInstructionsMessage(userId);
    await sendTelegramMessage(chatId, rechargeMsg, {
      reply_markup: MAIN_MENU_KEYBOARD,
    });
    return;
  }

  // Handle Help Command
  if (text === "/help" || text === "❓ Help") {
    await sendTelegramMessage(
      chatId,
      "ℹ️ *Menu & Commands:*\n\n" +
        "• *🪪 Print ID Card* (`/start`) - Verify FAN and generate print-ready ID cards\n" +
        "• *💰 Balance* (`/balance`) - View your remaining verification count\n" +
        "• *🎨 Card Template* (`/template`) - Switch card layout style\n" +
        "• *💳 Recharge (Upload Receipt)* - Instructions to top up your balance\n" +
        "• *❌ Cancel* (`/cancel`) - Cancel current active session\n" +
        "• *❓ Help* (`/help`) - View this help message\n\n" +
        "💡 *How to Recharge:* Transfer your payment and send the payment screenshot or PDF receipt directly into this chat anytime.",
      { reply_markup: MAIN_MENU_KEYBOARD }
    );
    return;
  }

  // Handle Card Template Selection Command
  const isTemplateCmd =
    text === "🎨 Card Template" ||
    text === "/template" ||
    text === "/templates" ||
    text.toLowerCase() === "template";

  if (isTemplateCmd) {
    const customer = await findCustomerByTelegramId(userId).catch(() => null);
    const session = getSession(userId, chatId);
    const currentTemplate = customer?.cardTemplate || session.cardTemplate || "template1";

    const templateNames: Record<string, string> = {
      template1: "Template 1 (Classic Standard)",
      template2: "Template 2 (Modern Blue Header)",
      template3: "Template 3 (Compact Layout)",
    };

    const templateMarkup = {
      inline_keyboard: [
        [
          {
            text: `${currentTemplate === "template1" ? "✅ " : ""}1. Classic Standard`,
            callback_data: "set_template:template1",
          },
        ],
        [
          {
            text: `${currentTemplate === "template2" ? "✅ " : ""}2. Modern Blue`,
            callback_data: "set_template:template2",
          },
        ],
        [
          {
            text: `${currentTemplate === "template3" ? "✅ " : ""}3. Compact Minimal`,
            callback_data: "set_template:template3",
          },
        ],
      ],
    };

    await sendTelegramMessage(
      chatId,
      `🎨 *Card Template Selection*\n\nCurrent layout: *${templateNames[currentTemplate] || "Template 1"}*\n\nSelect which template you'd like to use for your printed ID cards:`,
      { reply_markup: templateMarkup }
    );
    return;
  }

  // Handle Balance Command (Optimized for instant delivery)
  const trimmedLower = text.trim().toLowerCase();
  if (
    text === "/balance" ||
    text === "💰 Balance" ||
    text === "💰 Check Balance" ||
    trimmedLower === "balance" ||
    trimmedLower === "/balance"
  ) {
    // Immediately fetch customer's authoritative record (<5ms with cache)
    const customer = await findCustomerByTelegramId(userId).catch(() => null);

    // If the customer has no registered account, display a clear message asking them to contact the admin
    if (!customer) {
      const config = getPaymentConfig();
      const safeAdminUsername = (config.adminUsername || "Dirsan_A").replace(/[_*`\[\]]/g, "\\$&");
      const notRegisteredMsg =
        `⚠️ *Account Not Registered*\n\n` +
        `Your Telegram account is not yet registered in our verification system.\n\n` +
        `Please contact our administrator to activate your account and allocate verification credits:\n\n` +
        `👤 *Admin Contact:* @${safeAdminUsername}\n` +
        `🆔 *Your Telegram User ID:* \`${userId}\`\n\n` +
        `_Once registered by the administrator, your assigned verification balance will appear here._`;

      await sendTelegramMessage(chatId, notRegisteredMsg, {
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Return the balance assigned by the admin
    const remainingVerifications = typeof customer.balance === "number" ? customer.balance : 0;
    const usedVerifications = typeof customer.usedCount === "number" ? customer.usedCount : 0;
    const accountLabel = customer.telegramUsername
      ? `@${customer.telegramUsername.replace(/[_*`\[\]]/g, "\\$&")}`
      : `User \`${userId}\``;

    let balanceMsg =
      `💰 *Your Verification Balance*\n\n` +
      `• *Remaining balance:* ${remainingVerifications} verifications\n` +
      `• *Used verifications:* ${usedVerifications}\n` +
      `• *Account:* ${accountLabel}\n`;

    if (remainingVerifications <= 0) {
      balanceMsg +=
        `\n⚠️ *Your verification balance is 0.*\n` +
        `To verify and print Fayda ID cards, please top up your balance.\n\n` +
        `💳 *How to Recharge:*\n` +
        `Tap *💳 Recharge (Upload Receipt)* below or send your payment screenshot directly into this chat anytime!`;
    } else {
      balanceMsg += `\n✅ *Ready to print!* Tap *🪪 Print ID Card* to begin verification.`;
    }

    // Instant direct delivery in a single network roundtrip
    await sendTelegramMessage(chatId, balanceMsg, {
      reply_markup: MAIN_MENU_KEYBOARD,
    });
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
    // Handle /start or /restart command: send welcome and menu
    if (text === "/start" || text === "/restart") {
      clearSessionData(userId);
      await sendTelegramMessage(
        chatId,
        "👋 *Welcome to Fayda Bot!*\n\nSelect an option from the menu below to begin.",
        { reply_markup: MAIN_MENU_KEYBOARD }
      );
      return;
    }

    // Handle "Print ID Card" command
    if (text === "🪪 Print ID Card") {
      if (
        session.state === "REQUESTING_OTP" ||
        session.state === "VERIFYING_OTP" ||
        session.state === "GENERATING_CARD"
      ) {
        await sendTelegramMessage(
          chatId,
          "⏳ Your request is already being processed. Please wait..."
        );
        return;
      }

      if (session.state === "WAITING_FOR_OTP") {
        await sendTelegramMessage(
          chatId,
          "📲 An OTP has already been sent to your phone. Please reply with the *6-digit OTP code*, or tap *❌ Cancel* to start over.",
          { reply_markup: MAIN_MENU_KEYBOARD }
        );
        return;
      }

      const adminUsername = (process.env.ADMIN_TELEGRAM_USERNAME || "Dirsan_A").trim().replace(/^@/, "");

      // Check customer registration and balance
      const customer = await findCustomerByTelegramId(userId).catch(() => null);
      const availablePoints = customer && typeof customer.balance === "number" ? customer.balance : 0;

      if (!customer || availablePoints <= 0) {
        clearSessionData(userId);
        await sendTelegramMessage(
          chatId,
          buildInsufficientBalanceMessage(userId),
          { reply_markup: MAIN_MENU_KEYBOARD }
        );
        return;
      }

      // Check live provider service health using shared server key
      await sendTelegramAction(chatId, "typing");
      try {
        const providerBal = await fetchFaydaBalance();
        if (providerBal && typeof providerBal.points === "number" && providerBal.points <= 0) {
          clearSessionData(userId);
          await sendTelegramMessage(
            chatId,
            `⚠️ *Provider Service Temporarily Unavailable*\n\nThe provider system currently has 0 available credits. Please contact admin @${adminUsername} to replenish provider credits.`,
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
          return;
        }
      } catch (err: any) {
        clearSessionData(userId);
        const errMsg = err?.message || "Temporary connection issue with Fayda provider";
        await sendTelegramMessage(
          chatId,
          `⚠️ *Temporary Service Issue*\n\nUnable to verify provider status:\n_${errMsg}_\n\n🔄 Please tap *🪪 Print ID Card* to try again.`,
          { reply_markup: MAIN_MENU_KEYBOARD }
        );
        return;
      }

      clearSessionData(userId);
      updateSession(userId, { state: "WAITING_FOR_FAN", chatId });
      await sendTelegramMessage(
        chatId,
        `🪪 *Fayda National ID Verification*\n\nAvailable verifications: *${availablePoints}*\n\nPlease enter your *16-digit Fayda FAN number* (e.g. \`4952 8025 7094 3927\` or without spaces):`,
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

        // Authorize customer verification balance
        const customer = await findCustomerByTelegramId(userId).catch(() => null);
        const availableQuota = customer && typeof customer.balance === "number" ? customer.balance : 0;

        if (!customer || availableQuota <= 0) {
          clearSessionData(userId);
          await sendTelegramMessage(
            chatId,
            buildInsufficientBalanceMessage(userId),
            { reply_markup: MAIN_MENU_KEYBOARD }
          );
          return;
        }

        // Lock state to REQUESTING_OTP
        const reqId = `${Date.now()}-${Math.random()}`;
        updateSession(userId, { state: "REQUESTING_OTP", activeRequestId: reqId });

        await sendTelegramAction(chatId, "typing");
        await sendTelegramMessage(chatId, "⏳ Requesting OTP from Fayda system...");

        try {
          // Send OTP using customer's custom API key from database (if configured) or server default
          const customerApiKey = customer?.faydaApiKey?.trim() || undefined;
          const otpResponse = await requestFaydaOtp(cleanFan, customerApiKey);

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

          // Check customer API key from database if configured
          const customerRecord = await findCustomerByTelegramId(userId).catch(() => null);
          const customerApiKey = customerRecord?.faydaApiKey?.trim() || undefined;

          // Verify OTP using customer's custom API key (if configured) or server default
          const verifyResponse = await verifyFaydaOtp(
            cleanOtp,
            session.fanNumber,
            session.faydaSession,
            customerApiKey
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

          // Render single combined card image using customer's selected template
          const selectedTemplate: CardTemplateId = customerRecord?.cardTemplate || session.cardTemplate || "template1";
          console.log(`[Bot] Rendering combined side-by-side card buffer (Color, Template: ${selectedTemplate})...`);
          const combinedBuf = await renderCombinedCardBuffer(idData, "color", selectedTemplate);
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

          // Accurately record verification usage: decrement balance by 1, increment usedCount by 1
          const updatedCustomer = await recordCustomerVerificationUsage(userId);
          const remainingPoints = updatedCustomer && typeof updatedCustomer.balance === "number" ? updatedCustomer.balance : 0;

          // Clean session state for user so they can start fresh anytime
          clearSessionData(userId);

          await sendTelegramMessage(
            chatId,
            `🎉 *All done!* Your ID card has been delivered.\n💰 Remaining verifications: *${remainingPoints}*\n\nTap *🪪 Print ID Card* if you need to verify another ID.`,
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
