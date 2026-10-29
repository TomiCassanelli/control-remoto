export type Device = {
  id: string;
  name: string;
  host: string;
  port: number;
  source: "mdns" | "scan" | "manual";
};

export type ServerEvent =
  | { type: "devices"; devices: Device[] }
  | { type: "status"; status: "idle" | "connecting" | "pairing" | "connected" | "error"; message?: string; host?: string }
  | { type: "pairing-required"; message: string }
  | { type: "state"; powered?: boolean; volume?: { level: number; maximum: number; muted: boolean }; app?: string }
  | { type: "text-sync"; value: string };
