import { NextRequest, NextResponse } from "next/server";

const FAYDA_BASE_URL = "https://otp.affiliate.pro.et/api/v1";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const apiKey = (body?.apiKey || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API key is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || `Failed to check balance (Status ${res.status})`,
        },
        { status: res.status }
      );
    }

    const points =
      data?.remainingPoints ??
      data?.balance ??
      data?.points ??
      data?.credit ??
      0;

    return NextResponse.json({
      success: true,
      points: Number(points) || 0,
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error querying provider balance";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
