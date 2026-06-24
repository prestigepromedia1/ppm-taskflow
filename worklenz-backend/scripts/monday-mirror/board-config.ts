/**
 * Per-board column + status mapping for the Monday -> taskflow forward-mirror.
 *
 * Monday boards do not share column ids, so each board declares which column id
 * holds the title / client / type / status / dates. The status-label bridge
 * normalizes Monday status labels (and group names as a fallback) to the PPM
 * deliverable status enum.
 *
 * One-way only: nothing here writes back to Monday.
 */

export type PpmStatus =
  | "incoming"
  | "queued"
  | "in_progress"
  | "internal_review"
  | "client_review"
  | "revision"
  | "approved"
  | "done";

export interface BoardConfig {
  /** Human-readable board name (for logs). */
  name: string;
  /** Deliverable "type" bucket this board feeds. */
  type: "creative" | "web_ops";
  /** Monday column id holding the workflow status (status-type column). */
  statusColumnId: string;
  /** Monday column id linking to a client (board_relation or dropdown). */
  clientColumnId: string;
  /** Monday column id for the deliverable type/category (optional). */
  typeColumnId?: string;
  /** Monday column id for the long description / brief (optional). */
  descriptionColumnId?: string;
  /** Monday column id for the due date (optional). */
  dueDateColumnId?: string;
  /** Monday column id for the send date (optional). */
  sendDateColumnId?: string;
  /** Monday column id for an asset/review link (optional). */
  reviewLinkColumnId?: string;
  /**
   * Monday group ids to skip entirely (e.g. Graveyard, long-completed).
   * New items created in these groups are NOT mirrored.
   */
  skipGroupIds: string[];
}

/**
 * Default board configs for PPM's two Phase-1 pipelines.
 * Column ids were read live from the boards on build.
 */
export const DEFAULT_BOARD_CONFIGS: Record<string, BoardConfig> = {
  // Creative Pipeline
  "18392999987": {
    name: "Creative Pipeline",
    type: "creative",
    statusColumnId: "color_mkz44d8p", // Design Status
    clientColumnId: "board_relation_mkyxy64w", // Client (board relation)
    typeColumnId: "status_16", // Type
    descriptionColumnId: "long_text", // Creative Brief
    dueDateColumnId: "date", // Due Date (with Revisions)
    sendDateColumnId: "date_mkz4sk44", // Send Date
    reviewLinkColumnId: "link_mkz486c8", // Link to Review Asset
    skipGroupIds: ["group_title", "group_mm2tbh5c"], // Completed, Graveyard
  },
  // Website / Ops Pipeline
  "18398088564": {
    name: "Website / Ops Pipeline",
    type: "web_ops",
    statusColumnId: "color_mm04gmbp", // Status
    clientColumnId: "dropdown_mm04nxy2", // Client (dropdown)
    typeColumnId: "dropdown_mm04v5ab", // Request Type
    descriptionColumnId: "long_text_mm04j53e", // Description
    dueDateColumnId: "date_mm04p41p", // Due Date
    skipGroupIds: ["group_mm04yp19"], // Launched / Live (already shipped)
  },
};

/**
 * Normalize a Monday status label (or group name) into the PPM deliverable
 * status enum. Matching is case/space/punctuation-insensitive. Returns
 * `undefined` for "done/completed/graveyard"-style terminal labels the mirror
 * should skip, and `null` when nothing matched (caller falls back to "queued").
 *
 * `undefined` = explicit skip (terminal/old), `null` = unknown -> default queued.
 */
const STATUS_LABEL_BRIDGE: Record<string, PpmStatus | "__skip__"> = {
  // --- incoming / queued ---
  "newincoming": "incoming",
  "incoming": "incoming",
  "notstartedyet": "queued",
  "notstarted": "queued",
  "scoping": "queued",
  "readytostart": "queued",
  "queued": "queued",
  "todo": "queued",
  // --- in progress ---
  "inprogress": "in_progress",
  "workingonit": "in_progress",
  "stuck": "in_progress",
  "onholdstuck": "in_progress",
  "doing": "in_progress",
  // --- internal review ---
  "pendingreview": "internal_review",
  "qcreview": "internal_review",
  "qualitycheckreview": "internal_review",
  "internalreview": "internal_review",
  // --- client review ---
  "clientreview": "client_review",
  "feedbackprovided": "revision",
  // --- revision ---
  "revision": "revision",
  "revisions": "revision",
  "revisionsneeded": "revision",
  // --- approved ---
  "approved": "approved",
  "assetapproved": "approved",
  // --- terminal: skip new mirrors landing here ---
  "completed": "__skip__",
  "done": "__skip__",
  "livedone": "__skip__",
  "launchedlive": "__skip__",
  "graveyard": "__skip__",
};

function sanitizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map a Monday status label to a PPM status.
 * @returns a PpmStatus to mirror, or `undefined` to skip the item (terminal).
 *          Unknown labels resolve to "queued".
 */
export function mapStatusLabel(label: string | null | undefined): PpmStatus | undefined {
  if (!label || !label.trim()) return "queued";
  const key = sanitizeLabel(label);
  const mapped = STATUS_LABEL_BRIDGE[key];
  if (mapped === "__skip__") return undefined;
  if (mapped) return mapped;
  return "queued"; // unknown label -> safe default, still mirror it
}
