import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAnnouncementsCollection, AnnouncementDocument } from "@/lib/models/announcement";
import { getCustomersCollection } from "@/lib/models/customer";
import { sendTelegramMessage } from "@/lib/telegram/bot-service";

// Helper to broadcast announcement to all registered customers
async function broadcastAnnouncement(title: string, message: string): Promise<{ sent: number; total: number }> {
  const customerCol = await getCustomersCollection();
  const customers = await customerCol.find({}, { projection: { telegramUserId: 1 } }).toArray();

  const formattedMessage = `📢 *ANNOUNCEMENT: ${title}*\n\n${message}`;

  let sent = 0;
  for (const c of customers) {
    if (c.telegramUserId) {
      try {
        const res = await sendTelegramMessage(c.telegramUserId, formattedMessage);
        if (res && res.ok) {
          sent++;
        }
      } catch (err) {
        console.error(`[Announcement Broadcast] Failed sending to user ${c.telegramUserId}:`, err);
      }
      // Small throttle to stay well within Telegram limits (30 msgs/sec global)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return { sent, total: customers.length };
}

// GET /api/admin/announcements - list all announcements
export async function GET() {
  try {
    const col = await getAnnouncementsCollection();
    const announcements = await col.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      announcements: announcements.map((a) => ({
        id: a._id?.toString(),
        title: a.title,
        message: a.message,
        status: a.status,
        publishedAt: a.publishedAt || null,
        sentCount: a.sentCount ?? 0,
        totalTarget: a.totalTarget ?? 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/admin/announcements - create (draft or published) or publish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, publishNow } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: "Title and message are required." },
        { status: 400 }
      );
    }

    const col = await getAnnouncementsCollection();
    const now = new Date();

    const isPublishing = Boolean(publishNow);
    let broadcastStats = { sent: 0, total: 0 };

    if (isPublishing) {
      broadcastStats = await broadcastAnnouncement(title.trim(), message.trim());
    }

    const doc: AnnouncementDocument = {
      title: title.trim(),
      message: message.trim(),
      status: isPublishing ? "published" : "draft",
      publishedAt: isPublishing ? now : undefined,
      sentCount: isPublishing ? broadcastStats.sent : 0,
      totalTarget: isPublishing ? broadcastStats.total : 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
      message: isPublishing
        ? `Announcement published and sent to ${broadcastStats.sent}/${broadcastStats.total} users.`
        : "Announcement draft saved successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/admin/announcements - edit announcement or publish an existing one
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, message, publishNow } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Valid announcement ID is required." },
        { status: 400 }
      );
    }

    const col = await getAnnouncementsCollection();
    const existing = await col.findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 }
      );
    }

    const now = new Date();
    const isPublishing = Boolean(publishNow);
    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedMessage = message !== undefined ? message.trim() : existing.message;

    let broadcastStats = { sent: existing.sentCount || 0, total: existing.totalTarget || 0 };

    if (isPublishing) {
      broadcastStats = await broadcastAnnouncement(updatedTitle, updatedMessage);
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title: updatedTitle,
          message: updatedMessage,
          ...(isPublishing
            ? {
                status: "published",
                publishedAt: now,
                sentCount: broadcastStats.sent,
                totalTarget: broadcastStats.total,
              }
            : {}),
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: isPublishing
        ? `Announcement published and sent to ${broadcastStats.sent}/${broadcastStats.total} users.`
        : "Announcement updated successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/admin/announcements?id=... - delete an announcement
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Valid announcement ID is required." },
        { status: 400 }
      );
    }

    const col = await getAnnouncementsCollection();
    const result = await col.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Announcement not found or already deleted." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Announcement deleted successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
