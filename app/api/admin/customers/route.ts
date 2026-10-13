import { NextRequest, NextResponse } from "next/server";
import {
  getCustomersCollection,
  upsertCustomer,
  adjustCustomerBalance,
  findCustomerByTelegramId,
  deleteCustomer,
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
        let liveBalance = cust.balance || 0;

        if (cust.faydaApiKey) {
          const pBal = await fetchProviderBalance(cust.faydaApiKey);
          if (pBal && pBal.success) {
            liveBalance = Number(pBal.points ?? pBal.remainingPoints ?? pBal.balance ?? liveBalance);
            // Sync database balance with live provider count if different
            if (cust.balance !== liveBalance) {
              await col.updateOne(
                { telegramUserId: cust.telegramUserId },
                { $set: { balance: liveBalance, updatedAt: new Date() } }
              ).catch(() => {});
            }
            providerInfo = {
              remainingPoints: liveBalance,
              status: pBal.status || "active",
              username: pBal.username || null,
            };
          } else {
            providerInfo = {
              remainingPoints: "Error",
              status: pBal?.message || "Invalid/Inactive Key",
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
          balance: liveBalance,
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

// POST /api/admin/customers - Register or update a customer with individual API key
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

    let initialBalance = typeof body.balance === "number" ? body.balance : 0;

    if (body.faydaApiKey !== undefined) {
      const cleanKey = String(body.faydaApiKey).trim();
      updatePayload.faydaApiKey = cleanKey;

      if (cleanKey) {
        // Query provider with this individual customer's API key
        const pBal = await fetchProviderBalance(cleanKey);
        if (!pBal || !pBal.success) {
          return NextResponse.json(
            {
              success: false,
              message: pBal?.message || "Invalid Fayda API key. Provider rejected credentials.",
            },
            { status: 400 }
          );
        }
        // Retrieve that API's current verification balance automatically
        initialBalance = Number(pBal.points ?? pBal.remainingPoints ?? pBal.balance ?? 0);
      }
    }

    updatePayload.balance = initialBalance;

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

// PATCH /api/admin/customers - Increase or decrease customer verification allocation
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

    let providerInfo = null;
    if (updated.faydaApiKey) {
      const pBal = await fetchProviderBalance(updated.faydaApiKey);
      if (pBal && pBal.success) {
        providerInfo = {
          remainingPoints: pBal.points ?? pBal.remainingPoints ?? pBal.balance,
          status: pBal.status || "active",
        };
      }
    }

    return NextResponse.json({
      success: true,
      telegramUserId: updated.telegramUserId,
      newBalance: updated.balance,
      providerLimit: providerInfo,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/admin/customers - Remove a customer
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let userIdStr = searchParams.get("telegramUserId");
    if (!userIdStr) {
      const body = await req.json().catch(() => null);
      userIdStr = body?.telegramUserId;
    }

    if (!userIdStr) {
      return NextResponse.json(
        { success: false, message: "telegramUserId is required" },
        { status: 400 }
      );
    }

    const telegramUserId = Number(userIdStr);
    const success = await deleteCustomer(telegramUserId);

    if (!success) {
      return NextResponse.json(
        { success: false, message: "Customer not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Customer ${telegramUserId} removed successfully`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
