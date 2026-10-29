import { Bonjour } from "bonjour-service";
import net from "node:net";
import { networkInterfaces } from "node:os";
import type { Device } from "./types.js";

export class Discovery {
  private bonjour?: Bonjour;
  private devices = new Map<string, Device>();
  private browser?: ReturnType<Bonjour["find"]>;
  private onChange?: (devices: Device[]) => void;
  private scanPromise?: Promise<Device[]>;

  start(onChange: (devices: Device[]) => void) {
    this.onChange = onChange;
    if (process.env.DISABLE_MDNS === "1") return;
    this.bonjour = new Bonjour();
    this.browser = this.bonjour.find({ type: "androidtvremote2", protocol: "tcp" });
    this.browser.on("up", (service) => {
      const host = service.referer?.address ?? service.addresses?.find((value) => value.includes("."));
      if (!host) return;
      this.devices.set(host, {
        id: host,
        name: service.name || "Android TV / Flow",
        host,
        port: service.port || 6466,
        source: "mdns"
      });
      onChange(this.list());
    });
    this.browser.on("down", (service) => {
      for (const address of service.addresses ?? []) this.devices.delete(address);
      onChange(this.list());
    });
  }

  list() {
    return [...this.devices.values()];
  }

  scan() {
    if (this.scanPromise) return this.scanPromise;
    this.scanPromise = this.scanLocalNetwork().finally(() => { this.scanPromise = undefined; });
    return this.scanPromise;
  }

  private async scanLocalNetwork() {
    const ownAddresses = new Set<string>();
    const prefixes = new Set<string>();
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family !== "IPv4" || entry.internal || !isPrivate(entry.address)) continue;
        ownAddresses.add(entry.address);
        prefixes.add(entry.address.split(".").slice(0, 3).join("."));
      }
    }

    const candidates = [...prefixes].flatMap((prefix) => Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`)).filter((host) => !ownAddresses.has(host));
    const found: Device[] = [];
    const batchSize = 48;
    for (let offset = 0; offset < candidates.length; offset += batchSize) {
      const batch = candidates.slice(offset, offset + batchSize);
      const results = await Promise.all(batch.map(async (host) => ({ host, open: await hasRemotePort(host) })));
      for (const result of results) {
        if (!result.open) continue;
        const device: Device = { id: result.host, name: "Flow Box / Android TV", host: result.host, port: 6466, source: "scan" };
        this.devices.set(result.host, device);
        found.push(device);
      }
    }
    if (found.length > 0) this.onChange?.(this.list());
    return this.list();
  }

  stop() {
    this.browser?.stop();
    this.bonjour?.destroy();
  }
}

function isPrivate(address: string) {
  const [first, second] = address.split(".").map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

async function hasRemotePort(host: string) {
  return (await Promise.all([portOpen(host, 6466), portOpen(host, 6467)])).some(Boolean);
}

function portOpen(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(350);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
