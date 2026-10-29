import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Certificate = { cert: string; key: string };
type Preferences = { lastHost?: string };

const directory = path.resolve(process.cwd(), process.env.FLOW_REMOTE_DATA_DIR ?? ".flow-remote");

function safeHost(host: string) {
  return host.replace(/[^a-zA-Z0-9.-]/g, "_");
}

export async function loadCertificate(host: string): Promise<Certificate | undefined> {
  try {
    return JSON.parse(await readFile(path.join(directory, `${safeHost(host)}.json`), "utf8")) as Certificate;
  } catch {
    try {
      return JSON.parse(await readFile(path.join(directory, "paired-device.json"), "utf8")) as Certificate;
    } catch {
      return undefined;
    }
  }
}

export async function saveCertificate(host: string, certificate: Certificate) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${safeHost(host)}.json`), JSON.stringify(certificate, null, 2), { mode: 0o600 });
  await writeFile(path.join(directory, "paired-device.json"), JSON.stringify(certificate, null, 2), { mode: 0o600 });
}

export async function loadLastHost(): Promise<string | undefined> {
  try {
    const preferences = JSON.parse(await readFile(path.join(directory, "preferences.json"), "utf8")) as Preferences;
    return preferences.lastHost;
  } catch {
    return undefined;
  }
}

export async function saveLastHost(host: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "preferences.json"), JSON.stringify({ lastHost: host }, null, 2), { mode: 0o600 });
}
