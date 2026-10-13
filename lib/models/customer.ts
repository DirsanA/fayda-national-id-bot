import { getDb } from "@/lib/mongodb";
import type { Collection } from "mongodb";

export interface CustomerDocument {
  telegramUserId: number;
  telegramUsername?: string;
  faydaApiKey?: string;
  balance: number; // Admin-managed verification quota
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

export async function findCustomerByTelegramId(
  telegramUserId: number
): Promise<CustomerDocument | null> {
  const col = await getCustomersCollection();
  return col.findOne({ telegramUserId });
}

export async function upsertCustomer(
  telegramUserId: number,
  data: Partial<Omit<CustomerDocument, "telegramUserId" | "createdAt">>
): Promise<CustomerDocument | null> {
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

export async function adjustCustomerBalance(
  telegramUserId: number,
  amount: number
): Promise<CustomerDocument | null> {
  const col = await getCustomersCollection();
  const now = new Date();
  await col.updateOne(
    { telegramUserId },
    {
      $inc: { balance: amount },
      $set: { updatedAt: now },
    }
  );
  return col.findOne({ telegramUserId });
}

export async function deleteCustomer(
  telegramUserId: number
): Promise<boolean> {
  const col = await getCustomersCollection();
  const res = await col.deleteOne({ telegramUserId });
  return res.deletedCount > 0;
}
