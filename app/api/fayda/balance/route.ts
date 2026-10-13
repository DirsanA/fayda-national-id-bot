import { NextRequest, NextResponse } from "next/server";
import { getCustomersCollection } from "@/lib/models/customer";

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${BASE_URL}/balance`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || `Provider balance query failed (HTTP ${res.status})`,
        },
        { status: res.status }
      );
    }

    const liveProviderPoints = Number(
      data?.remainingPoints ?? data?.points ?? data?.balance ?? data?.credit ?? 0
    );

    // Sum currently allocated customer verification balances directly from MongoDB
    let allocatedPoints = 0;
    let customerCount = 0;
    try {
      const col = await getCustomersCollection();
      const [agg, count] = await Promise.all([
        col
          .aggregate<{ total: number }>([
            { $group: { _id: null, total: { $sum: "$balance" } } },
          ])
          .toArray(),
        col.countDocuments(),
      ]);
      allocatedPoints = agg.length > 0 && typeof agg[0].total === "number" ? agg[0].total : 0;
      customerCount = count;
    } catch (dbErr) {
      console.error("[Fayda Balance API] MongoDB aggregate error:", dbErr);
    }

    const remainingDistributable = Math.max(0, liveProviderPoints - allocatedPoints);

    return NextResponse.json({
      success: true,
      liveProviderPoints,
      allocatedPoints,
      remainingDistributable,
      customerCount,
      points: remainingDistributable,
      status: liveProviderPoints > 0 ? (data?.status || "active") : "exhausted",
      username: data?.username || null,
      printPrice: data?.printPrice,
      otpMethod: data?.otpMethod,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
