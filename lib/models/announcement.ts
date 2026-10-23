import { getDb } from "@/lib/mongodb";
import { Collection, ObjectId } from "mongodb";

export interface AnnouncementDocument {
  _id?: ObjectId;
  title: string;
  message: string;
  status: "draft" | "published";
  publishedAt?: Date;
  sentCount?: number;
  totalTarget?: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAnnouncementsCollection(): Promise<Collection<AnnouncementDocument>> {
  const db = await getDb();
  return db.collection<AnnouncementDocument>("announcements");
}
