import fs from "fs";
import path from "path";
import os from "os";

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
  cardTemplate?: "template1" | "template2" | "template3" | "template4";
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

// File-based persistent session store for serverless & local development environments.
// On Vercel / AWS Lambda, process.cwd() is read-only. We use os.tmpdir() so it works without crashing.
const STORAGE_DIR = path.join(os.tmpdir(), "national_id_sessions");
const SESSIONS_FILE = path.join(STORAGE_DIR, "telegram_sessions.json");

function ensureStorageDir() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    // Non-fatal warning if /tmp creation fails; in-memory fallback will handle it
    console.warn("Notice: Session storage dir creation skipped or in-memory fallback:", err);
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

// Attach in-memory session map to globalThis so Next.js hot module reloads (HMR) during dev do not wipe active sessions
const globalForSessions = globalThis as unknown as {
  inMemorySessions?: Map<number, UserSession>;
  saveTimeout?: NodeJS.Timeout | null;
  isSaving?: boolean;
};

if (!globalForSessions.inMemorySessions) {
  globalForSessions.inMemorySessions = loadSessions();
}
const inMemorySessions = globalForSessions.inMemorySessions;

function saveSessionsNow() {
  try {
    ensureStorageDir();
    const now = Date.now();
    const validSessions = Array.from(inMemorySessions.values()).filter(
      (s) => now - s.updatedAt < SESSION_TTL_MS
    );
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(validSessions), "utf-8");
  } catch (err) {
    console.error("Failed to write sessions to file:", err);
  }
}

function scheduleSaveSessions() {
  if (globalForSessions.saveTimeout) return;
  globalForSessions.saveTimeout = setTimeout(async () => {
    globalForSessions.saveTimeout = null;
    saveSessionsNow();
  }, 100);
}

export function getSession(userId: number, chatId: number): UserSession {
  const now = Date.now();
  let session = inMemorySessions.get(userId);

  // If not found in memory, try refreshing from file before creating a blank IDLE session
  if (!session) {
    const fileSessions = loadSessions();
    const fromFile = fileSessions.get(userId);
    if (fromFile && now - fromFile.updatedAt <= SESSION_TTL_MS) {
      session = fromFile;
      inMemorySessions.set(userId, session);
    }
  }

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

  // For critical OTP state transitions, save immediately to disk so hot-reloads or restarts never lose OTP state
  if (partial.state === "WAITING_FOR_OTP" || partial.state === "WAITING_FOR_FAN" || partial.state === "VERIFYING_OTP") {
    saveSessionsNow();
  } else {
    scheduleSaveSessions();
  }

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
