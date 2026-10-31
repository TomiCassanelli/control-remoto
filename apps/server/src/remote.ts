import net from "node:net";
import { createAndroidRemote, RemoteDirection, RemoteKeyCode } from "@kud/androidtv-remote";
import { loadCertificate, loadLastHost, saveCertificate, saveLastHost } from "./cert-store.js";
import type { Device, ServerEvent } from "./types.js";

const keys = {
  home: RemoteKeyCode.KEYCODE_HOME,
  back: RemoteKeyCode.KEYCODE_BACK,
  up: RemoteKeyCode.KEYCODE_DPAD_UP,
  down: RemoteKeyCode.KEYCODE_DPAD_DOWN,
  left: RemoteKeyCode.KEYCODE_DPAD_LEFT,
  right: RemoteKeyCode.KEYCODE_DPAD_RIGHT,
  ok: RemoteKeyCode.KEYCODE_DPAD_CENTER,
  volumeUp: RemoteKeyCode.KEYCODE_VOLUME_UP,
  volumeDown: RemoteKeyCode.KEYCODE_VOLUME_DOWN,
  mute: RemoteKeyCode.KEYCODE_VOLUME_MUTE,
  power: RemoteKeyCode.KEYCODE_POWER,
  playPause: RemoteKeyCode.KEYCODE_MEDIA_PLAY_PAUSE,
  delete: RemoteKeyCode.KEYCODE_DEL,
  apps: RemoteKeyCode.KEYCODE_ALL_APPS,
  channelUp: RemoteKeyCode.KEYCODE_CHANNEL_UP,
  channelDown: RemoteKeyCode.KEYCODE_CHANNEL_DOWN,
  previousChannel: RemoteKeyCode.KEYCODE_LAST_CHANNEL,
  digit0: RemoteKeyCode.KEYCODE_0,
  digit1: RemoteKeyCode.KEYCODE_1,
  digit2: RemoteKeyCode.KEYCODE_2,
  digit3: RemoteKeyCode.KEYCODE_3,
  digit4: RemoteKeyCode.KEYCODE_4,
  digit5: RemoteKeyCode.KEYCODE_5,
  digit6: RemoteKeyCode.KEYCODE_6,
  digit7: RemoteKeyCode.KEYCODE_7,
  digit8: RemoteKeyCode.KEYCODE_8,
  digit9: RemoteKeyCode.KEYCODE_9
} as const;

export type RemoteKey = keyof typeof keys;

export class RemoteController {
  private remote?: ReturnType<typeof createAndroidRemote>;
  private host?: string;
  private lastText = "";
  private status: Extract<ServerEvent, { type: "status" }> = { type: "status", status: "idle", message: "Buscando tu deco Flow…" };
  private emit: (event: ServerEvent) => void;

  constructor(emit: (event: ServerEvent) => void) {
    this.emit = emit;
  }

  snapshot() {
    return this.status;
  }

  async autoConnect(devices: Device[]) {
    if (this.status.status !== "idle" && this.status.status !== "error") return;
    const lastHost = await loadLastHost();
    const host = devices.length === 1 ? devices[0].host : lastHost;
    if (host) await this.connect(host);
  }

  private setStatus(event: Omit<Extract<ServerEvent, { type: "status" }>, "type">) {
    this.status = { type: "status", ...event };
    this.emit(this.status);
  }

  async probe(host: string) {
    const check = (port: number) => new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port });
      const done = (result: boolean) => { socket.destroy(); resolve(result); };
      socket.setTimeout(1500);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });
    const [remote, pairing] = await Promise.all([check(6466), check(6467)]);
    return { remote, pairing };
  }

  async connect(host: string) {
    if (this.host === host && this.status.status !== "idle" && this.status.status !== "error") return;
    this.disconnect();
    this.host = host;
    this.setStatus({ status: "connecting", host, message: "Conectando automáticamente con tu Flow Box…" });
    const cert = await loadCertificate(host);
    const remote = createAndroidRemote(host, {
      pairing_port: 6467,
      remote_port: 6466,
      service_name: "Flow Remote Web",
      ...(cert ? { cert } : {})
    });
    this.remote = remote;

    remote.on("secret", () => {
      this.setStatus({ status: "pairing", host, message: "Primera conexión: ingresá el código que aparece en la TV." });
      this.emit({ type: "pairing-required", message: "Ingresá el código de 6 caracteres que aparece en la TV." });
    });
    remote.on("ready", async () => {
      await saveCertificate(host, remote.getCertificate());
      await saveLastHost(host);
      this.setStatus({ status: "connected", host, message: "Listo para usar" });
    });
    remote.on("powered", (powered: boolean) => this.emit({ type: "state", powered }));
    remote.on("volume", (volume) => this.emit({ type: "state", volume }));
    remote.on("current_app", (app: string) => this.emit({ type: "state", app }));
    remote.on("error", (error: Error) => this.setStatus({ status: "error", host, message: error.message }));

    try {
      await remote.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo conectar";
      this.setStatus({ status: "error", host, message });
    }
  }

  pair(code: string) {
    if (!this.remote) throw new Error("Primero conectá un dispositivo");
    this.remote.sendCode(code.trim().toUpperCase());
  }

  key(key: RemoteKey, action: "short" | "start" | "end" = "short") {
    if (!this.remote) throw new Error("El control no está conectado");
    const direction = action === "start" ? RemoteDirection.START_LONG : action === "end" ? RemoteDirection.END_LONG : RemoteDirection.SHORT;
    this.remote.sendKey(keys[key], direction);
  }

  channel(channel: string) {
    if (!this.remote) throw new Error("El control no está conectado");
    const remote = this.remote;
    [...channel].forEach((digit, index) => {
      setTimeout(() => remote.sendKey(keys[`digit${digit}` as RemoteKey], RemoteDirection.SHORT), index * 90);
    });
    setTimeout(() => remote.sendKey(RemoteKeyCode.KEYCODE_DPAD_CENTER, RemoteDirection.SHORT), channel.length * 90 + 350);
  }

  text(value: string) {
    if (!this.remote) throw new Error("El control no está conectado");
    const previous = [...this.lastText];
    const next = [...value];
    let shared = 0;
    while (shared < previous.length && shared < next.length && previous[shared] === next[shared]) shared++;

    for (let index = shared; index < previous.length; index++) {
      this.remote.sendKey(RemoteKeyCode.KEYCODE_DEL, RemoteDirection.SHORT);
    }

    const inserted = next.slice(shared).join("");
    if (inserted) this.remote.sendText(inserted);
    this.lastText = value;
    this.emit({ type: "text-sync", value });
  }

  clearText() {
    if (!this.remote) throw new Error("El control no está conectado");
    const deletes = Math.max([...this.lastText].length, 80);
    for (let index = 0; index < deletes; index++) {
      this.remote.sendKey(RemoteKeyCode.KEYCODE_DEL, RemoteDirection.SHORT);
    }
    this.lastText = "";
    this.emit({ type: "text-sync", value: "" });
  }

  link(url: string) {
    if (!this.remote) throw new Error("El control no está conectado");
    this.remote.sendAppLink(url);
  }

  disconnect() {
    try { this.remote?.stop(); } catch { /* already closed */ }
    this.remote = undefined;
    this.host = undefined;
    this.lastText = "";
    this.setStatus({ status: "idle", message: "Buscando tu deco Flow…" });
  }
}
