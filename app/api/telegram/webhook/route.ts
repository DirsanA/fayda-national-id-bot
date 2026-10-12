import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/bot-service";

const processedUpdates = new Set<number>();

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

    const updateId = update.update_id;
    if (typeof updateId === "number") {
      if (processedUpdates.has(updateId)) {
        // Already processing or processed this update: acknowledge immediately to Telegram
        return NextResponse.json({ ok: true });
      }
      processedUpdates.add(updateId);
      // Clean set if it grows over 5,000 entries
      if (processedUpdates.size > 5000) {
        processedUpdates.clear();
      }
    }

    const messageType = update.message
      ? "message"
      : update.callback_query
      ? "callback_query"
      : Object.keys(update).find((k) => k !== "update_id") || "other";

    console.log(`[Telegram Webhook] Received update ID: ${updateId ?? "unknown"} (type: ${messageType})`);

    // Process update in background to guarantee instant <50ms 200 OK acknowledgment to Telegram
    // This prevents Telegram webhook timeouts and duplicate webhook retries while preserving full isolation.
    handleTelegramUpdate(update).catch((handlerErr: unknown) => {
      const msg = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      console.error(`[Telegram Webhook] Background error processing update ID ${updateId}:`, msg);
    });

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
