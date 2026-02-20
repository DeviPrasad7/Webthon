import { Response } from "express";
import { listenChannel } from "./db.js";

/**
 * Global SSE client registry.
 * Maps objective_id -> array of connected response objects.
 */
const sseClients = new Map<string, Response[]>();

/**
 * Register an SSE client for a given objective.
 * Sets up heartbeat and cleanup on close.
 */
export function registerSSEClient(objectiveId: string, res: Response): void {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx compat
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ event: "connected" })}\n\n`);

  // 15-second heartbeat to prevent PaaS 55s timeout
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  // Add to client map
  const existing = sseClients.get(objectiveId) || [];
  existing.push(res);
  sseClients.set(objectiveId, existing);

  // Cleanup on client disconnect
  res.on("close", () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(objectiveId);
    if (clients) {
      const filtered = clients.filter((c) => c !== res);
      if (filtered.length === 0) {
        sseClients.delete(objectiveId);
      } else {
        sseClients.set(objectiveId, filtered);
      }
    }
  });
}

/**
 * Send an SSE event to all clients watching a given objective.
 */
export function sendSSEEvent(objectiveId: string, data: object): void {
  const clients = sseClients.get(objectiveId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

/**
 * Initialize the LISTEN/NOTIFY bridge.
 * Listens on Postgres channel and forwards events to SSE clients.
 */
export async function initSSEListener(): Promise<void> {
  await listenChannel("objective_updates", (payload) => {
    try {
      const data = JSON.parse(payload);
      if (data.id) {
        sendSSEEvent(data.id, { event: "updated" });
      }
    } catch (err) {
      console.error("[SSE] Failed to parse notification payload:", err);
    }
  });
  console.log("[SSE] Listener initialized.");
}
