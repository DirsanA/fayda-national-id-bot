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

export async function getCustomersCollection(): Promise<Collection<CustomerDocument>> {
  const db = await getDb();
  const col = db.collection<CustomerDocument>("customers");
  // Ensure index on telegramUserId
  await col.createIndex({ telegramUserId: 1 }, { unique: true }).catch(() => {});
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
