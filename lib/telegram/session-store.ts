import fs from "fs";
import path from "path";

export type SessionState =
  | "IDLE"
  | "WAITING_FOR_FAN"
  | "REQUESTING_OTP"
  | "WAITING_FOR_OTP"
  | "VERIFYING_OTP"
  | "GENERATING_CARD"
  | "COMPLETED"
  | "CANCELLED";

export interface UserSession {
  userId: number;
  chatId: number;
  state: SessionState;
  fanNumber?: string;
  faydaSession?: string;
  phone?: string;
  updatedAt: number;
  requestCount: number;
  lastRequestTime: number;
  activeRequestId?: string;
}

// In-memory mutex locks per user to prevent concurrent race conditions
const userLocks = new Set<number>();

export function acquireUserLock(userId: number): boolean {
  if (userLocks.has(userId)) {
    return false;
  }
  userLocks.add(userId);
  return true;
}

export function releaseUserLock(userId: number) {
  userLocks.delete(userId);
}

// TTL: Sessions expire after 10 minutes of inactivity
const SESSION_TTL_MS = 10 * 60 * 1000;
// Rate limit: Max 15 messages/requests per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

// File-based persistent session store for serverless & local development environments
const STORAGE_DIR = path.join(process.cwd(), ".sessions");
const SESSIONS_FILE = path.join(STORAGE_DIR, "telegram_sessions.json");

function ensureStorageDir() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create session storage dir:", err);
  }
}

function loadSessions(): Map<number, UserSession> {
  const map = new Map<number, UserSession>();
  try {
    ensureStorageDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const list: UserSession[] = JSON.parse(raw);
      const now = Date.now();
      for (const item of list) {
        // Discard expired sessions on load
        if (now - item.updatedAt < SESSION_TTL_MS) {
          map.set(item.userId, item);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to read session file, initializing empty:", err);
  }
  return map;
}

// Asynchronous debounced session persistence to keep Node event loop unblocked
let saveTimeout: NodeJS.Timeout | null = null;
let isSaving = false;

function scheduleSaveSessions() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    if (isSaving) {
      // Reschedule if another save is actively in flight
      scheduleSaveSessions();
      return;
    }
    isSaving = true;
    try {
      ensureStorageDir();
      const now = Date.now();
      const validSessions = Array.from(inMemorySessions.values()).filter(
        (s) => now - s.updatedAt < SESSION_TTL_MS
      );
      await fs.promises.writeFile(
        SESSIONS_FILE,
        JSON.stringify(validSessions),
        "utf-8"
      );
    } catch (err) {
      console.error("Failed to save sessions to file:", err);
    } finally {
      isSaving = false;
    }
  }, 100);
}

let inMemorySessions = loadSessions();

export function getSession(userId: number, chatId: number): UserSession {
  const now = Date.now();
  let session = inMemorySessions.get(userId);

  if (!session || now - session.updatedAt > SESSION_TTL_MS) {
    session = {
      userId,
      chatId,
      state: "IDLE",
      updatedAt: now,
      requestCount: 0,
      lastRequestTime: now,
    };
    inMemorySessions.set(userId, session);
    scheduleSaveSessions();
  }

  return session;
}

export function updateSession(userId: number, partial: Partial<UserSession>): UserSession {
  const current = inMemorySessions.get(userId) || {
    userId,
    chatId: partial.chatId || userId,
    state: "IDLE" as SessionState,
    updatedAt: Date.now(),
    requestCount: 0,
    lastRequestTime: Date.now(),
  };

  const updated: UserSession = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  };

  inMemorySessions.set(userId, updated);
  scheduleSaveSessions();
  return updated;
}

export function clearSessionData(userId: number) {
  const session = inMemorySessions.get(userId);
  if (session) {
    session.state = "IDLE";
    delete session.fanNumber;
    delete session.faydaSession;
    delete session.phone;
    delete session.activeRequestId;
    session.updatedAt = Date.now();
    scheduleSaveSessions();
  }
}

export function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const session = inMemorySessions.get(userId);
  if (!session) return true;

  if (now - session.lastRequestTime > RATE_LIMIT_WINDOW_MS) {
    session.requestCount = 1;
    session.lastRequestTime = now;
  } else {
    session.requestCount += 1;
  }

  // No need to persist file on pure rate limit increment unless updated
  return session.requestCount <= MAX_REQUESTS_PER_WINDOW;
}
