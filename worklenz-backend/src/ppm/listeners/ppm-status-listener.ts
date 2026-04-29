import pgModule from "pg";
import dbConfig from "../../config/db-config";
import { IO } from "../../shared/io";
import { log_error } from "../../shared/utils";

const pg = (process.env.USE_PG_NATIVE === "true" && pgModule.native) ? pgModule.native : pgModule;

/**
 * LISTEN/NOTIFY listener for ppm_status_change channel.
 * Proven in spike 002: receives real-time notifications when deliverable status changes.
 *
 * Routes notifications to:
 * 1. Socket.IO room for the client (client portal real-time updates)
 * 2. Socket.IO room for internal users watching that project
 * 3. Future: email notifications, Slack webhooks, etc.
 */
export class PpmStatusListener {
  private client: pgModule.Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    try {
      this.client = new pg.Client(dbConfig);
      await this.client.connect();

      this.client.on("notification", (msg) => {
        if (msg.channel === "ppm_status_change" && msg.payload) {
          this.handleStatusChange(msg.payload);
        }
      });

      this.client.on("error", (err) => {
        console.error("[PPM] LISTEN connection error:", err.message);
        this.scheduleReconnect();
      });

      this.client.on("end", () => {
        console.log("[PPM] LISTEN connection ended, reconnecting...");
        this.scheduleReconnect();
      });

      await this.client.query("LISTEN ppm_status_change");
      console.log("[PPM] LISTEN/NOTIFY listener started on ppm_status_change");
    } catch (error) {
      console.error("[PPM] Failed to start LISTEN/NOTIFY listener:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log("[PPM] Reconnecting LISTEN/NOTIFY...");
      await this.stop();
      await this.start();
    }, 5000);
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        // ignore cleanup errors
      }
      this.client = null;
    }
  }

  private handleStatusChange(payload: string): void {
    try {
      const data = JSON.parse(payload);
      const { deliverable_id, old_status, new_status, client_id, visibility } = data;

      console.log(`[PPM] Status change: ${old_status} → ${new_status} (deliverable=${deliverable_id}, client=${client_id})`);

      const io = IO.getInstance();
      if (!io) return;

      // Emit to client portal room (only if client-visible)
      if (visibility === "client_visible") {
        io.to(`ppm:client:${client_id}`).emit("ppm:deliverable:status_change", {
          deliverable_id,
          old_status,
          new_status,
          timestamp: data.timestamp,
        });
      }

      // Always emit to internal room for this client
      io.to(`ppm:internal:${client_id}`).emit("ppm:deliverable:status_change", {
        deliverable_id,
        old_status,
        new_status,
        client_id,
        visibility,
        timestamp: data.timestamp,
      });

      // Emit to global internal room (cross-client views like Creative Pipeline)
      io.to("ppm:internal:all").emit("ppm:deliverable:status_change", {
        deliverable_id,
        old_status,
        new_status,
        client_id,
        visibility,
        timestamp: data.timestamp,
      });

    } catch (error) {
      log_error(error);
    }
  }
}

// Singleton
export const ppmStatusListener = new PpmStatusListener();
