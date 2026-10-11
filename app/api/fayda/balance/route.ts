import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://otp.affiliate.pro.et/api/v1";

export async function GET(req: NextRequest) {
  try {
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

    const res = await fetch(`${BASE_URL}/balance`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
