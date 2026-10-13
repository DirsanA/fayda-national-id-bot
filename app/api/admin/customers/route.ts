import { NextRequest, NextResponse } from "next/server";
import {
  getCustomersCollection,
  createCustomer,
  updateCustomer,
  upsertCustomer,
  adjustCustomerBalance,
  findCustomerByTelegramId,
  deleteCustomer,
  deleteCustomerAndRefund,
} from "@/lib/models/customer";

// GET /api/admin/customers - List all registered customers with their authoritative balance
export async function GET(req: NextRequest) {
  try {
    const col = await getCustomersCollection();
    const customers = await col.find({}).sort({ updatedAt: -1 }).toArray();

    const mapped = customers.map((cust) => {
      const balance = typeof cust.balance === "number" ? cust.balance : 0;
      const usedCount = typeof cust.usedCount === "number" ? cust.usedCount : 0;

      return {
        telegramUserId: cust.telegramUserId,
        telegramUsername: cust.telegramUsername || null,
        hasApiKey: Boolean(cust.faydaApiKey),
        maskedApiKey: cust.faydaApiKey
          ? `${cust.faydaApiKey.slice(0, 8)}...${cust.faydaApiKey.slice(-4)}`
          : null,
        balance,
        usedCount,
        providerLimit: {
          remainingPoints: balance,
          status: balance > 0 ? "active" : "exhausted",
        },
        updatedAt: cust.updatedAt,
      };
    });

    return NextResponse.json({ success: true, customers: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

const FAYDA_BASE_URL = "https://otp.affiliate.pro.et/api/v1";

// In-memory mutex to prevent concurrent requests from exceeding the available pool
let isAdjusting = false;
const lockQueue: (() => void)[] = [];

async function acquireAdjustmentLock(): Promise<() => void> {
  if (!isAdjusting) {
    isAdjusting = true;
    return () => {
      isAdjusting = false;
      const next = lockQueue.shift();
      if (next) next();
    };
  }
  return new Promise((resolve) => {
    lockQueue.push(() => {
      isAdjusting = true;
      resolve(() => {
        isAdjusting = false;
        const next = lockQueue.shift();
        if (next) next();
      });
    });
  });
}

// Helper to query live available points of default admin Fayda key
async function fetchDefaultAdminProviderBalance(): Promise<number | null> {
  const apiKey = (process.env.FAYDA_API_KEY || "").trim();
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const points = Number(
      data?.remainingPoints ?? data?.points ?? data?.balance ?? data?.credit ?? 0
    );
    return isNaN(points) ? null : points;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Helper to calculate the remaining available balance in the default admin pool:
// totalProviderPoints - totalPointsAllocatedToCustomers
async function getAdminAvailableBalance(): Promise<{
  providerPoints: number;
  allocatedPoints: number;
  availablePoints: number;
} | null> {
  const providerPoints = await fetchDefaultAdminProviderBalance();
  if (providerPoints === null) return null;
  try {
    const col = await getCustomersCollection();
    const agg = await col
      .aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ])
      .toArray();
    const allocatedPoints =
      agg.length > 0 && typeof agg[0].total === "number" ? agg[0].total : 0;
    const availablePoints = Math.max(0, providerPoints - allocatedPoints);
    return { providerPoints, allocatedPoints, availablePoints };
  } catch {
    return {
      providerPoints,
      allocatedPoints: 0,
      availablePoints: providerPoints,
    };
  }
}

// POST /api/admin/customers - Register or update a customer with authoritative balance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.telegramUserId === undefined || body.telegramUserId === null) {
      return NextResponse.json(
        { success: false, message: "Telegram Numeric ID is required." },
        { status: 400 }
      );
    }

    const telegramUserId = Number(body.telegramUserId);
    if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid positive numeric Telegram ID is required." },
        { status: 400 }
      );
    }

    const rawBalance = body.balance !== undefined ? Number(body.balance) : 0;
    if (isNaN(rawBalance) || rawBalance < 0) {
      return NextResponse.json(
        { success: false, message: "Verification balance must be 0 or greater." },
        { status: 400 }
      );
    }

    const isUpdate = Boolean(body.isUpdate);
    const cleanUsername =
      body.telegramUsername !== undefined && body.telegramUsername !== null
        ? String(body.telegramUsername).replace(/^@/, "").trim() || undefined
        : undefined;

    // Acquire lock to guarantee concurrency safety and prevent exceeding balance pool
    const releaseLock = await acquireAdjustmentLock();

    try {
      // Check if customer already exists using the unique telegramUserId index
      const existing = await findCustomerByTelegramId(telegramUserId);

      if (!isUpdate && existing) {
        return NextResponse.json(
          {
            success: false,
            message: `Customer ${telegramUserId} is already registered. To change their balance, click Edit in the customer list.`,
          },
          { status: 409 }
        );
      }

      // Check balance limit if allocating new or increased balance
      const currentBal = existing ? (typeof existing.balance === "number" ? existing.balance : 0) : 0;
      const additionalAllocated = isUpdate ? Math.max(0, rawBalance - currentBal) : rawBalance;

      if (additionalAllocated > 0) {
        const balInfo = await getAdminAvailableBalance();
        if (balInfo === null) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot allocate calls: live provider balance could not be verified. Please check provider API connection.",
            },
            { status: 503 }
          );
        }
        if (additionalAllocated > balInfo.availablePoints) {
          return NextResponse.json(
            {
              success: false,
              message: `Cannot allocate ${additionalAllocated} calls. Only ${balInfo.availablePoints} distributable calls remain (Live Provider: ${balInfo.providerPoints}, Total Allocated: ${balInfo.allocatedPoints}).`,
            },
            { status: 400 }
          );
        }
      }

      let customerResult;
      if (isUpdate) {
        customerResult = await updateCustomer(telegramUserId, {
          telegramUsername: cleanUsername,
          balance: rawBalance,
        });
        if (!customerResult) {
          // If not found, upsert as fallback
          customerResult = await upsertCustomer(telegramUserId, {
            telegramUsername: cleanUsername,
            balance: rawBalance,
          });
        }
      } else {
        customerResult = await createCustomer(telegramUserId, {
          telegramUsername: cleanUsername,
          balance: rawBalance,
        });
      }

      if (!customerResult) {
        throw new Error("Failed to save customer record.");
      }

      return NextResponse.json({
        success: true,
        customer: {
          telegramUserId: customerResult.telegramUserId,
          telegramUsername: customerResult.telegramUsername,
          balance: customerResult.balance,
        },
      });
    } finally {
      releaseLock();
    }
  } catch (err: any) {
    // Explicitly handle MongoDB E11000 duplicate key error from unique index on telegramUserId
    if (
      err &&
      typeof err === "object" &&
      ("code" in err && err.code === 11000 ||
        ("message" in err && String(err.message).includes("E11000")))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Customer is already registered in the database (duplicate Telegram ID).`,
        },
        { status: 409 }
      );
    }

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

    if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid positive numeric Telegram ID is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(adjustment) || adjustment === 0) {
      return NextResponse.json(
        { success: false, message: "Adjustment must be a non-zero integer." },
        { status: 400 }
      );
    }

    // Acquire lock to guarantee atomic concurrency safety across balance updates
    const releaseLock = await acquireAdjustmentLock();

    try {
      if (adjustment > 0) {
        const balInfo = await getAdminAvailableBalance();
        if (balInfo === null) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot adjust balance: live provider balance could not be verified. Please check provider API connection.",
            },
            { status: 503 }
          );
        }
        if (adjustment > balInfo.availablePoints) {
          return NextResponse.json(
            {
              success: false,
              message: `Cannot allocate ${adjustment} calls. Only ${balInfo.availablePoints} distributable calls remain (Live Provider: ${balInfo.providerPoints}, Total Allocated: ${balInfo.allocatedPoints}).`,
            },
            { status: 400 }
          );
        }
      }

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
        providerLimit: {
          remainingPoints: updated.balance,
          status: updated.balance > 0 ? "active" : "exhausted",
        },
      });
    } finally {
      releaseLock();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/admin/customers - Remove a customer and return unused balance to admin available pool
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
    if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid positive numeric Telegram ID is required." },
        { status: 400 }
      );
    }

    // Acquire lock to guarantee atomic concurrency safety across balance updates, adjustments, and deletions
    const releaseLock = await acquireAdjustmentLock();

    try {
      // Atomically delete customer and retrieve their unused balance
      // Prevents concurrent duplicate deletions or double refunds
      const result = await deleteCustomerAndRefund(telegramUserId);

      if (!result.deleted) {
        return NextResponse.json(
          { success: false, message: "Customer not found or already deleted" },
          { status: 404 }
        );
      }

      // Calculate refreshed admin available balance after returning customer's unused balance
      const balInfo = await getAdminAvailableBalance();

      return NextResponse.json({
        success: true,
        message:
          result.refundedBalance > 0
            ? `Customer ${telegramUserId} removed successfully. ${result.refundedBalance} unused API verification ${
                result.refundedBalance === 1 ? "call" : "calls"
              } returned to admin available balance.`
            : `Customer ${telegramUserId} removed successfully.`,
        refundedBalance: result.refundedBalance,
        adminAvailableBalance: balInfo?.availablePoints ?? null,
      });
    } finally {
      releaseLock();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
