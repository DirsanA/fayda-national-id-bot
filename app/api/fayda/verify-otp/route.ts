import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://otp.affiliate.pro.et/api/v1";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = (process.env.FAYDA_API_KEY || req.headers.get("x-api-key") || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "FAYDA_API_KEY is not configured on the server. Please add FAYDA_API_KEY to your .env file.",
        },
        { status: 401 }
      );
    }

    const { otp, fanNumber, session } = body;
    if (!otp || !fanNumber || !session) {
      return NextResponse.json(
        { success: false, message: "otp, fanNumber, and session are all required" },
        { status: 400 }
      );
    }

    // 120-second timeout controller as required by Fayda API guide for upstream verification
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(`${BASE_URL}/verify-otp-json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          otp: String(otp).trim(),
          fanNumber: String(fanNumber).replace(/\s+/g, ""),
          session, // Sent back exactly as received from Step 1
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return NextResponse.json(
          {
            success: false,
            message: data?.message || `Verification failed (status ${res.status})`,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        return NextResponse.json(
          { success: false, message: "Upstream Fayda verification timed out after 120 seconds." },
          { status: 504 }
        );
      }
      throw fetchErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
