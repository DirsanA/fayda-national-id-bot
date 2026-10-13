import { NextRequest, NextResponse } from "next/server";
import {
  getCustomersCollection,
  upsertCustomer,
  adjustCustomerBalance,
  findCustomerByTelegramId,
} from "@/lib/models/customer";

const FAYDA_BASE_URL = "https://otp.affiliate.pro.et/api/v1";

// Helper to query Fayda provider balance for a specific customer's API key
async function fetchProviderBalance(apiKey: string): Promise<any> {
  if (!apiKey) return null;
  try {
    const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

// GET /api/admin/customers - List all registered customers with their balance and provider limit
export async function GET(req: NextRequest) {
  try {
    const col = await getCustomersCollection();
    const customers = await col.find({}).sort({ updatedAt: -1 }).toArray();

    // Enrich customers with provider balance if they have an API key configured
    const enriched = await Promise.all(
      customers.map(async (cust) => {
        let providerInfo = null;
        if (cust.faydaApiKey) {
          const pBal = await fetchProviderBalance(cust.faydaApiKey);
          if (pBal) {
            providerInfo = {
              remainingPoints: pBal.remainingPoints ?? pBal.balance ?? pBal.points ?? "N/A",
              status: pBal.status || "active",
            };
          }
        }
        return {
          telegramUserId: cust.telegramUserId,
          telegramUsername: cust.telegramUsername || null,
          hasApiKey: Boolean(cust.faydaApiKey),
          // Mask API key for security so it is never exposed in plain text in UI responses
          maskedApiKey: cust.faydaApiKey
            ? `${cust.faydaApiKey.slice(0, 8)}...${cust.faydaApiKey.slice(-4)}`
            : null,
          balance: cust.balance || 0,
          providerLimit: providerInfo,
          updatedAt: cust.updatedAt,
        };
      })
    );

    return NextResponse.json({ success: true, customers: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/admin/customers - Register or update a customer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.telegramUserId) {
      return NextResponse.json(
        { success: false, message: "telegramUserId is required" },
        { status: 400 }
      );
    }

    const telegramUserId = Number(body.telegramUserId);
    if (isNaN(telegramUserId) || telegramUserId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid numeric telegramUserId is required" },
        { status: 400 }
      );
    }

    const updatePayload: any = {};
    if (body.telegramUsername !== undefined) {
      updatePayload.telegramUsername = String(body.telegramUsername).replace(/^@/, "").trim();
    }
    if (body.faydaApiKey !== undefined) {
      updatePayload.faydaApiKey = String(body.faydaApiKey).trim();
    }
    if (body.balance !== undefined && !isNaN(Number(body.balance))) {
      updatePayload.balance = Number(body.balance);
    }

    const updated = await upsertCustomer(telegramUserId, updatePayload);

    return NextResponse.json({
      success: true,
      customer: {
        telegramUserId: updated?.telegramUserId,
        telegramUsername: updated?.telegramUsername,
        balance: updated?.balance,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PATCH /api/admin/customers - Increase or decrease verification count
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.telegramUserId || typeof body.adjustment !== "number") {
      return NextResponse.json(
        { success: false, message: "telegramUserId and numeric adjustment are required" },
        { status: 400 }
      );
    }

    const telegramUserId = Number(body.telegramUserId);
    const adjustment = Number(body.adjustment);

    const updated = await adjustCustomerBalance(telegramUserId, adjustment);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      telegramUserId: updated.telegramUserId,
      newBalance: updated.balance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
