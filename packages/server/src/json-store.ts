import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { SessionHistoryEntry, SessionStore, SSEEvent } from "@neeter/types";

function sanitize(sdkSessionId: string): string {
  return sdkSessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * File-based `SessionStore` using append-only JSONL event logs and JSON metadata sidecars.
 * Creates `{dataDir}/sessions/` on first call. Data is written unencrypted —
 * use for development and trusted environments only.
 */
export function createJsonSessionStore(dataDir: string): SessionStore {
  const sessionsDir = join(dataDir, "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  function eventsPath(sdkSessionId: string): string {
    return join(sessionsDir, `${sanitize(sdkSessionId)}.jsonl`);
  }

  function metaPath(sdkSessionId: string): string {
    return join(sessionsDir, `${sanitize(sdkSessionId)}.meta.json`);
  }

  return {
    async save(sdkSessionId, record) {
      writeFileSync(metaPath(sdkSessionId), JSON.stringify(record.meta));
      for (const evt of record.events) {
        appendFileSync(eventsPath(sdkSessionId), `${JSON.stringify(evt)}\n`);
      }
    },

    async load(sdkSessionId) {
      const mp = metaPath(sdkSessionId);
      const ep = eventsPath(sdkSessionId);
      if (!existsSync(mp)) return null;
      const meta = JSON.parse(readFileSync(mp, "utf-8")) as SessionHistoryEntry;
      const events: SSEEvent[] = [];
      if (existsSync(ep)) {
        for (const line of readFileSync(ep, "utf-8").split("\n")) {
          if (line) events.push(JSON.parse(line) as SSEEvent);
        }
      }
      return { meta, events };
    },

    async list() {
      if (!existsSync(sessionsDir)) return [];
      const entries: SessionHistoryEntry[] = [];
      for (const file of readdirSync(sessionsDir)) {
        if (!file.endsWith(".meta.json")) continue;
        try {
          entries.push(JSON.parse(readFileSync(join(sessionsDir, file), "utf-8")));
        } catch {
          // skip corrupt files
        }
      }
      return entries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    },

    async delete(sdkSessionId) {
      const ep = eventsPath(sdkSessionId);
      const mp = metaPath(sdkSessionId);
      if (existsSync(ep)) unlinkSync(ep);
      if (existsSync(mp)) unlinkSync(mp);
    },
  };
}
