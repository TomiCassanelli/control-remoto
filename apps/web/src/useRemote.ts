import { useCallback, useEffect, useRef, useState } from "react";

export type Device = { id: string; name: string; host: string; port: number; source: "mdns" | "scan" | "manual" };
type Status = "idle" | "connecting" | "pairing" | "connected" | "error";
export type DeviceState = { powered?: boolean; volume?: { level: number; maximum: number; muted: boolean }; app?: string };
type Event =
  | { type: "devices"; devices: Device[] }
  | { type: "status"; status: Status; message?: string; host?: string }
  | { type: "pairing-required"; message: string }
  | ({ type: "state" } & DeviceState)
  | { type: "text-sync"; value: string };

export function useRemote() {
  const socket = useRef<WebSocket | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Buscando tu deco Flow…");
  const [host, setHost] = useState<string>();
  const [deviceState, setDeviceState] = useState<DeviceState>({});
  const [remoteText, setRemoteText] = useState("");

  useEffect(() => {
    let retry: number;
    let active = true;
    const open = () => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => {
        setMessage("Conectando automáticamente…");
        ws.send(JSON.stringify({ type: "auto-connect" }));
      };
      ws.onmessage = ({ data }) => {
        const event = JSON.parse(String(data)) as Event;
        if (event.type === "devices") setDevices(event.devices);
        if (event.type === "status") {
          setStatus(event.status);
          setHost(event.host);
          if (event.message) setMessage(event.message);
        }
        if (event.type === "pairing-required") setMessage(event.message);
        if (event.type === "state") setDeviceState((current) => ({ ...current, ...event }));
        if (event.type === "text-sync") setRemoteText(event.value);
      };
      ws.onclose = () => {
        if (!active) return;
        setStatus("error");
        setMessage("Se perdió la conexión con el servidor. Reintentando…");
        retry = window.setTimeout(open, 1500);
      };
    };
    open();
    return () => { active = false; clearTimeout(retry); socket.current?.close(); };
  }, []);

  const send = useCallback((command: unknown) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(command));
    else setMessage("El servidor todavía no está conectado");
  }, []);

  return { devices, status, message, host, deviceState, remoteText, send };
}
