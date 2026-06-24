/**
 * Per-board cursor (last-run high-water mark) persistence.
 *
 * State is a JSON file: { "<boardId>": "<ISO timestamp of newest mirrored item>" }.
 * The cursor only advances on a fully successful board pass; a failed POST leaves
 * the cursor where it was so the item is retried next run (at-least-once).
 */

import { promises as fs } from "fs";
import path from "path";

export interface MirrorState {
  [boardId: string]: string; // ISO timestamp
}

export class CursorStore {
  constructor(private filePath: string) {}

  async load(): Promise<MirrorState> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err: any) {
      if (err?.code === "ENOENT") return {};
      throw err;
    }
  }

  async save(state: MirrorState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    // Atomic-ish write: temp file + rename.
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmp, this.filePath);
  }

  /** Default cursor when a board has never been mirrored: now (only mirror NEW items). */
  static defaultCursor(): string {
    return new Date().toISOString();
  }
}
