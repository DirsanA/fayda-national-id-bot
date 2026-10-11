import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://otp.affiliate.pro.et/api/v1";

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

    const { fanNumber } = body;
    if (!fanNumber) {
      return NextResponse.json(
        { success: false, message: "fanNumber is required" },
        { status: 400 }
      );
    }

    const cleanedFan = String(fanNumber).replace(/\s+/g, "");

    const res = await fetch(`${BASE_URL}/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ fanNumber: cleanedFan }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || `Fayda API error (status ${res.status})`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
