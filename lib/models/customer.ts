import { getDb } from "@/lib/mongodb";
import type { Collection } from "mongodb";

export interface CustomerDocument {
  telegramUserId: number;
  telegramUsername?: string;
  faydaApiKey?: string;
  balance: number; // Admin-managed verification quota
  usedCount?: number; // Total verifications consumed
  cardTemplate?: "template1" | "template2" | "template3";
  createdAt: Date;
  updatedAt: Date;
}

let indexEnsuredPromise: Promise<void> | null = null;

/**
 * Safely inspects the customers collection and creates a unique index on
 * `telegramUserId` if an equivalent index does not already exist.
 * Checks for and resolves duplicate IDs before index creation to ensure data safety.
 */
async function ensureCustomerIndexes(col: Collection<CustomerDocument>): Promise<void> {
  try {
    const existingIndexes = await col.indexes();
    
    // Check if an equivalent unique index on telegramUserId already exists
    const hasEquivalentIndex = existingIndexes.some(
      (idx) =>
        idx.key &&
        Boolean(idx.key.telegramUserId) &&
        idx.unique === true
    );

    if (hasEquivalentIndex) {
      return;
    }

    // Check for duplicate telegramUserId entries before creating unique index
    const duplicates = await col
      .aggregate<{ _id: number; count: number; docIds: any[] }>([
        { $match: { telegramUserId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$telegramUserId",
            count: { $sum: 1 },
            docIds: { $push: "$_id" },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    // Safely handle duplicate entries: preserve the newest record and purge stale duplicates
    if (duplicates.length > 0) {
      console.warn(`[MongoDB] Detected ${duplicates.length} duplicate telegramUserId groups. Resolving safely...`);
      for (const group of duplicates) {
        const docs = await col
          .find({ telegramUserId: group._id })
          .sort({ updatedAt: -1, _id: -1 })
          .toArray();

        // Keep docs[0] (most recently updated), remove the rest
        const staleDocIds = docs.slice(1).map((d) => d._id);
        if (staleDocIds.length > 0) {
          await col.deleteMany({ _id: { $in: staleDocIds } });
        }
      }
    }

    // Create unique index (sparse ensures safety if any document lacks telegramUserId)
    await col.createIndex({ telegramUserId: 1 }, { unique: true, sparse: true });
  } catch (err) {
    // Reset promise on error so subsequent requests can retry
    indexEnsuredPromise = null;
    console.error("[MongoDB] Failed to ensure unique index on telegramUserId:", err);
  }
}

export async function getCustomersCollection(): Promise<Collection<CustomerDocument>> {
  const db = await getDb();
  const col = db.collection<CustomerDocument>("customers");

  // Lightweight single-flight index initialization
  if (!indexEnsuredPromise) {
    indexEnsuredPromise = ensureCustomerIndexes(col);
  }
  await indexEnsuredPromise;

  return col;
}

const customerCache = new Map<number, { doc: CustomerDocument | null; expires: number }>();

export function invalidateCustomerCache(telegramUserId?: number) {
  if (telegramUserId !== undefined) {
    customerCache.delete(telegramUserId);
  } else {
    customerCache.clear();
  }
}

export async function findCustomerByTelegramId(
  telegramUserId: number
): Promise<CustomerDocument | null> {
  const cached = customerCache.get(telegramUserId);
  if (cached && Date.now() < cached.expires) {
    return cached.doc;
  }
  const col = await getCustomersCollection();
  const doc = await col.findOne({ telegramUserId });
  customerCache.set(telegramUserId, { doc, expires: Date.now() + 5000 });
  return doc;
}

export async function createCustomer(
  telegramUserId: number,
  data: {
    telegramUsername?: string;
    balance: number;
    faydaApiKey?: string;
    cardTemplate?: "template1" | "template2" | "template3";
  }
): Promise<CustomerDocument> {
  const col = await getCustomersCollection();
  const now = new Date();
  const doc: CustomerDocument = {
    telegramUserId,
    telegramUsername: data.telegramUsername || undefined,
    faydaApiKey: data.faydaApiKey || undefined,
    balance: Math.max(0, typeof data.balance === "number" ? data.balance : 0),
    usedCount: 0,
    cardTemplate: data.cardTemplate || "template1",
    createdAt: now,
    updatedAt: now,
  };
  customerCache.delete(telegramUserId);
  await col.insertOne(doc);
  return doc;
}

export async function updateCustomer(
  telegramUserId: number,
  data: {
    telegramUsername?: string;
    balance?: number;
    faydaApiKey?: string;
    cardTemplate?: "template1" | "template2" | "template3";
  }
): Promise<CustomerDocument | null> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const now = new Date();
  const updateFields: any = { updatedAt: now };
  if (data.telegramUsername !== undefined) {
    updateFields.telegramUsername = data.telegramUsername || undefined;
  }
  if (typeof data.balance === "number") {
    updateFields.balance = Math.max(0, data.balance);
  }
  if (data.faydaApiKey !== undefined) {
    updateFields.faydaApiKey = data.faydaApiKey || undefined;
  }
  if (data.cardTemplate !== undefined) {
    updateFields.cardTemplate = data.cardTemplate;
  }

  return col.findOneAndUpdate(
    { telegramUserId },
    { $set: updateFields },
    { returnDocument: "after" }
  );
}

export async function upsertCustomer(
  telegramUserId: number,
  data: Partial<Omit<CustomerDocument, "telegramUserId" | "createdAt">>
): Promise<CustomerDocument | null> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const now = new Date();
  const updateData: any = {
    ...data,
    updatedAt: now,
  };

  const setOnInsertData: any = {
    telegramUserId,
    createdAt: now,
  };

  // Only initialize balance on insert if it is not explicitly provided in $set
  if (data.balance === undefined) {
    setOnInsertData.balance = 0;
  }

  await col.updateOne(
    { telegramUserId },
    {
      $set: updateData,
      $setOnInsert: setOnInsertData,
    },
    { upsert: true }
  );

  return col.findOne({ telegramUserId });
}

export async function recordCustomerVerificationUsage(
  telegramUserId: number
): Promise<CustomerDocument | null> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const now = new Date();
  // Atomic decrement: only decrement if balance > 0 to prevent negative balances or concurrent double-draws
  const res = await col.findOneAndUpdate(
    { telegramUserId, balance: { $gt: 0 } },
    {
      $inc: { balance: -1, usedCount: 1 },
      $set: { updatedAt: now },
    },
    { returnDocument: "after" }
  );
  if (res) return res;
  return col.findOne({ telegramUserId });
}

export async function adjustCustomerBalance(
  telegramUserId: number,
  amount: number
): Promise<CustomerDocument | null> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const now = new Date();

  if (amount < 0) {
    // If decrementing, prevent negative balances
    const abs = Math.abs(amount);
    const res = await col.findOneAndUpdate(
      { telegramUserId, balance: { $gte: abs } },
      {
        $inc: { balance: amount },
        $set: { updatedAt: now },
      },
      { returnDocument: "after" }
    );
    if (res) return res;
    // If balance was less than deduction, floor at 0
    return col.findOneAndUpdate(
      { telegramUserId },
      {
        $set: { balance: 0, updatedAt: now },
      },
      { returnDocument: "after" }
    );
  }

  return col.findOneAndUpdate(
    { telegramUserId },
    {
      $inc: { balance: amount },
      $set: { updatedAt: now },
    },
    { returnDocument: "after" }
  );
}

export interface DeleteCustomerResult {
  deleted: boolean;
  refundedBalance: number;
  telegramUserId: number;
  customer?: CustomerDocument;
}

/**
 * Atomically deletes a customer document and returns their unused balance.
 * Using findOneAndDelete guarantees that concurrent deletion requests will only
 * find and delete the document once, preventing duplicate refunds or double deletions.
 */
export async function deleteCustomerAndRefund(
  telegramUserId: number
): Promise<DeleteCustomerResult> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const deletedDoc = await col.findOneAndDelete({ telegramUserId });

  if (!deletedDoc) {
    return {
      deleted: false,
      refundedBalance: 0,
      telegramUserId,
    };
  }

  const unusedBalance =
    typeof deletedDoc.balance === "number" && deletedDoc.balance > 0
      ? deletedDoc.balance
      : 0;

  return {
    deleted: true,
    refundedBalance: unusedBalance,
    telegramUserId,
    customer: deletedDoc,
  };
}

export async function deleteCustomer(
  telegramUserId: number
): Promise<boolean> {
  const res = await deleteCustomerAndRefund(telegramUserId);
  return res.deleted;
}

export async function updateCustomerCardTemplate(
  telegramUserId: number,
  cardTemplate: "template1" | "template2" | "template3"
): Promise<CustomerDocument | null> {
  customerCache.delete(telegramUserId);
  const col = await getCustomersCollection();
  const now = new Date();
  return col.findOneAndUpdate(
    { telegramUserId },
    {
      $set: { cardTemplate, updatedAt: now },
    },
    { returnDocument: "after" }
  );
}


