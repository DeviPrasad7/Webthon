import { Response } from "express";
import { listenChannel } from "./db.js";

const sseClients = new Map<string, Response[]>();

export function registerSSEClient(objectiveId: string, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ event: "connected" })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  const existing = sseClients.get(objectiveId) || [];
  existing.push(res);
  sseClients.set(objectiveId, existing);

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

export function sendSSEEvent(objectiveId: string, data: object): void {
  const clients = sseClients.get(objectiveId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

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
