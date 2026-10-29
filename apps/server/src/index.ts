import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { Discovery } from "./discovery.js";
import { RemoteController, type RemoteKey } from "./remote.js";
import type { ServerEvent } from "./types.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const port = Number(process.env.PORT ?? 8787);
const clients = new Set<WebSocket>();
let sharedState: Extract<ServerEvent, { type: "state" }> = { type: "state" };
let sharedText = "";

function broadcast(event: ServerEvent) {
  if (event.type === "state") sharedState = { ...sharedState, ...event };
  if (event.type === "text-sync") sharedText = event.value;
  const value = JSON.stringify(event);
  for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(value);
}

const discovery = new Discovery();
const remote = new RemoteController(broadcast);

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connect"), host: z.string().min(1) }),
  z.object({ type: z.literal("auto-connect") }),
  z.object({ type: z.literal("probe"), host: z.string().min(1) }),
  z.object({ type: z.literal("pair"), code: z.string().regex(/^[A-Za-z0-9]{6}$/) }),
  z.object({ type: z.literal("key"), key: z.enum(["home", "back", "up", "down", "left", "right", "ok", "volumeUp", "volumeDown", "mute", "power", "playPause", "delete", "apps", "channelUp", "channelDown", "previousChannel", "digit0", "digit1", "digit2", "digit3", "digit4", "digit5", "digit6", "digit7", "digit8", "digit9"]), action: z.enum(["short", "start", "end"]).optional() }),
  z.object({ type: z.literal("text"), value: z.string().max(500) }),
  z.object({ type: z.literal("clear-text") }),
  z.object({ type: z.literal("link"), url: z.url() }),
  z.object({ type: z.literal("disconnect") })
]);

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: "devices", devices: discovery.list() } satisfies ServerEvent));
  socket.send(JSON.stringify(remote.snapshot()));
  socket.send(JSON.stringify(sharedState));
  socket.send(JSON.stringify({ type: "text-sync", value: sharedText } satisfies ServerEvent));
  socket.on("close", () => clients.delete(socket));
  socket.on("message", async (raw) => {
    try {
      const command = commandSchema.parse(JSON.parse(raw.toString()));
      if (command.type === "auto-connect") {
        const devices = discovery.list();
        if (devices.length > 0) await remote.autoConnect(devices);
        else setTimeout(async () => {
          const found = await discovery.scan();
          await remote.autoConnect(found);
        }, 900);
      }
      if (command.type === "connect") await remote.connect(command.host);
      if (command.type === "probe") {
        const result = await remote.probe(command.host);
        broadcast({ type: "status", status: result.remote || result.pairing ? "idle" : "error", host: command.host, message: result.remote || result.pairing ? `Servicio encontrado (control: ${result.remote ? "sí" : "no"}, vinculación: ${result.pairing ? "sí" : "no"})` : "No están accesibles los puertos 6466/6467. Revisá que ambos equipos estén en la misma red y que Control remoto de Android TV esté habilitado." });
      }
      if (command.type === "pair") remote.pair(command.code);
      if (command.type === "key") remote.key(command.key as RemoteKey, command.action);
      if (command.type === "text") remote.text(command.value);
      if (command.type === "clear-text") remote.clearText();
      if (command.type === "link") remote.link(command.url);
      if (command.type === "disconnect") remote.disconnect();
    } catch (error) {
      broadcast({ type: "status", status: "error", message: error instanceof Error ? error.message : "Comando inválido" });
    }
  });
});

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
app.use(express.static(webDist));
app.use((_request, response) => response.sendFile(path.join(webDist, "index.html")));

discovery.start((devices) => {
  broadcast({ type: "devices", devices });
  if (clients.size > 0) void remote.autoConnect(devices);
});
server.listen(port, "0.0.0.0", () => console.log(`Flow Remote disponible en http://localhost:${port}`));

function shutdown() {
  remote.disconnect();
  discovery.stop();
  server.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
