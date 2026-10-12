import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/bot-service";

export async function POST(req: NextRequest) {
  try {
    // Optional webhook secret verification
    const secretTokenHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const configuredSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();

    // Verify secret token if configured
    if (configuredSecret && secretTokenHeader !== configuredSecret) {
      console.warn(
        `[Telegram Webhook] 401 Unauthorized: secret mismatch (received: ${secretTokenHeader ? "provided" : "none"})`
      );
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const update = await req.json().catch(() => null);
    if (!update) {
      console.warn("[Telegram Webhook] 400 Bad Request: missing or invalid JSON body");
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
    }

    const updateId = update.update_id ?? "unknown";
    const messageType = update.message
      ? "message"
      : update.callback_query
      ? "callback_query"
      : Object.keys(update).find((k) => k !== "update_id") || "other";

    console.log(`[Telegram Webhook] Received update ID: ${updateId} (type: ${messageType})`);

    // Await update processing and capture any runtime errors safely
    try {
      await handleTelegramUpdate(update);
      console.log(`[Telegram Webhook] Successfully processed update ID: ${updateId}`);
    } catch (handlerErr: unknown) {
      const msg = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      console.error(`[Telegram Webhook] Error processing update ID ${updateId}:`, msg);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Telegram Webhook] Unexpected route error:", errorMsg);
    return NextResponse.json({ ok: true }); // Always acknowledge to prevent Telegram retry storms
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Telegram webhook endpoint is running.",
  });
}
