import { useEffect, useRef, useState } from "react";
import { AppWindow, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, CirclePower, Delete, Gamepad2, Grid3X3, Home, Keyboard, Pencil, Play, RotateCcw, Search, Star, Volume1, Volume2, VolumeX, Wifi, X } from "lucide-react";
import { siAppletv, siHbo, siNetflix, siPrimevideo, siYoutube } from "simple-icons";
import { useRemote } from "./useRemote";

const KeyButton = ({ label, icon, onPress, className = "" }: { label: string; icon: React.ReactNode; onPress: () => void; className?: string }) => (
  <button className={`key ${className}`} onClick={onPress} aria-label={label}>{icon}<span>{label}</span></button>
);

const BrandIcon = ({ icon }: { icon: { path: string; title: string } }) => (
  <svg className="brand-logo" role="img" aria-label={icon.title} viewBox="0 0 24 24"><path d={icon.path} /></svg>
);

const DisneyLogo = () => <img className="disney-logo" src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg" alt="Disney+" />;

const RemoteLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6.5" y="2" width="11" height="20" rx="4" />
    <circle cx="12" cy="6" r="1.4" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 9.8v1.1M12 13.1v1.1M9.8 12h1.1M13.1 12h1.1M9.5 18h1M13.5 18h1" />
  </svg>
);

const HoldButton = ({ label, remoteKey, sendKey, className = "", children }: { label: string; remoteKey: string; sendKey: (key: string, action?: "short" | "start" | "end") => void; className?: string; children: React.ReactNode }) => {
  const timer = useRef<number | undefined>(undefined);
  const holding = useRef(false);
  const release = () => {
    if (timer.current) window.clearTimeout(timer.current);
    sendKey(remoteKey, holding.current ? "end" : "short");
    timer.current = undefined;
    holding.current = false;
  };
  return <button className={className} aria-label={label} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); holding.current = false; timer.current = window.setTimeout(() => { holding.current = true; sendKey(remoteKey, "start"); }, 380); }} onPointerUp={release} onPointerCancel={() => { if (timer.current) window.clearTimeout(timer.current); if (holding.current) sendKey(remoteKey, "end"); holding.current = false; }}>{children}</button>;
};

export function App() {
  const { devices, status, message, host, remoteText, send } = useRemote();
  const [manualHost, setManualHost] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"control" | "apps" | "channels" | "keyboard">("channels");
  const [searchApp, setSearchApp] = useState("youtube");
  const [appSearch, setAppSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("flow-remote-favorite-channels") ?? "null");
      return Array.isArray(saved) && saved.length ? saved.filter((value): value is string => typeof value === "string" && /^\d{1,4}$/.test(value)) : ["10", "12", "101", "109", "123"];
    } catch { return ["10", "12", "101", "109", "123"]; }
  });
  const [editingFavorites, setEditingFavorites] = useState(false);
  const [favoritesDraft, setFavoritesDraft] = useState("");
  const connected = status === "connected";
  const key = (value: string, action: "short" | "start" | "end" = "short") => {
    if (action !== "end") navigator.vibrate?.(8);
    send({ type: "key", key: value, action });
  };
  useEffect(() => { setText(remoteText); }, [remoteText]);
  useEffect(() => { localStorage.setItem("flow-remote-favorite-channels", JSON.stringify(favorites)); }, [favorites]);

  const startEditingFavorites = () => {
    setFavoritesDraft(favorites.join(", "));
    setEditingFavorites(true);
  };
  const saveFavorites = () => {
    const next = [...new Set(favoritesDraft.split(/[\s,;]+/).map((value) => value.replace(/\D/g, "")).filter((value) => /^\d{1,4}$/.test(value)))].slice(0, 12);
    setFavorites(next);
    setEditingFavorites(false);
  };
  const tuneChannel = (channel: string) => {
    navigator.vibrate?.(10);
    send({ type: "channel", channel });
  };

  const openSearch = () => {
    const query = encodeURIComponent(appSearch.trim());
    const urls: Record<string, string> = {
      youtube: `https://www.youtube.com/results?search_query=${query}`,
      netflix: `https://www.netflix.com/search?q=${query}`,
      prime: `https://app.primevideo.com/search?phrase=${query}`,
      apple: `https://tv.apple.com/search?term=${query}`,
      disney: "https://www.disneyplus.com/search",
      hbo: "https://play.max.com/search"
    };
    navigator.vibrate?.(10);
    send({ type: "link", url: urls[searchApp] });
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark"><RemoteLogo /></div>
        <div className="brand-copy"><h1>Control Remoto</h1></div>
        <button className="power" onClick={() => key("power")} disabled={!connected} aria-label="Encender o apagar"><CirclePower /></button>
      </header>

      {!connected && <section className={`status-card ${status}`}>
        <span className="status-dot" />
        <div className="status-copy"><strong>{status === "pairing" ? "Vinculando" : status === "connecting" ? "Conectando" : status === "error" ? "Atención" : "Buscando dispositivos"}</strong><p>{message}</p></div>
      </section>}

      {(status === "idle" || status === "error") && (
        <section className="setup panel">
          <div className="section-title"><Wifi /><div><h2>Primera conexión</h2><p>Flow Box Skyworth / Android TV</p></div></div>
          <div className="devices">
            {devices.map((device) => <button key={device.id} className="device" onClick={() => send({ type: "connect", host: device.host })}><span className="tv-icon">TV</span><span><b>{device.name}</b><small>{device.host}</small></span><ArrowRight /></button>)}
            {!devices.length && <p className="empty">Todavía no apareció ninguno. Podés usar la IP que figura en Ajustes → Red del deco.</p>}
          </div>
          <div className="manual"><input value={manualHost} onChange={(event) => setManualHost(event.target.value)} placeholder="IP del deco, ej. 192.168.1.34" inputMode="decimal" /><button onClick={() => send({ type: "connect", host: manualHost.trim() })} disabled={!manualHost.trim()}>Conectar</button><button className="ghost" onClick={() => send({ type: "probe", host: manualHost.trim() })} disabled={!manualHost.trim()}>Diagnosticar</button></div>
        </section>
      )}

      {status === "pairing" && (
        <section className="pair panel"><h2>Código de la pantalla</h2><p>Ingresalo una sola vez; la identidad queda guardada localmente.</p><div><input value={pairCode} onChange={(event) => setPairCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6))} placeholder="ABC123" autoFocus /><button onClick={() => send({ type: "pair", code: pairCode })} disabled={pairCode.length !== 6}>Vincular</button></div></section>
      )}

      <section className={`remote tab-${tab} ${!connected ? "disabled" : ""}`} aria-disabled={!connected}>
        {connected && <div className="section-heading">
          <div>
            <p className="eyebrow">{tab === "control" ? "NAVEGACIÓN" : tab === "apps" ? "CONTENIDO" : tab === "channels" ? "TELEVISIÓN" : "ENTRADA DE TEXTO"}</p>
            <h2>{tab === "control" ? "Control" : tab === "apps" ? "Aplicaciones" : tab === "channels" ? "Canales" : "Teclado"}</h2>
          </div>
          <span>{tab === "control" ? "Mantené para repetir" : tab === "apps" ? "Abrí o buscá contenido" : tab === "channels" ? "Elegí un canal" : "Escribí desde el celular"}</span>
        </div>}
        <div className={`tab-stage panel tab-stage-${tab}`}>
        {tab === "apps" && <div className="app-launcher">
          <div className="app-cell"><button aria-label="Inicio" onClick={() => key("home")}><Home /></button></div>
          <div className="app-cell"><button aria-label="Aplicaciones" onClick={() => key("apps")}><Grid3X3 /></button></div>
          <div className="app-cell"><button className="youtube" aria-label="YouTube" onClick={() => send({ type: "link", url: "https://www.youtube.com/" })}><BrandIcon icon={siYoutube} /></button></div>
          <div className="app-cell"><button className="netflix" aria-label="Netflix" onClick={() => send({ type: "link", url: "nflx://www.netflix.com/Browse" })}><BrandIcon icon={siNetflix} /></button></div>
          <div className="app-cell"><button className="prime" aria-label="Prime Video" onClick={() => send({ type: "link", url: "https://app.primevideo.com/" })}><BrandIcon icon={siPrimevideo} /></button></div>
          <div className="app-cell"><button className="apple" aria-label="Apple TV" onClick={() => send({ type: "link", url: "https://tv.apple.com/" })}><BrandIcon icon={siAppletv} /></button></div>
          <div className="app-cell"><button className="disney" aria-label="Disney+" onClick={() => send({ type: "link", url: "https://www.disneyplus.com/" })}><DisneyLogo /></button></div>
          <div className="app-cell"><button className="hbo" aria-label="HBO Max" onClick={() => send({ type: "link", url: "https://play.max.com/" })}><BrandIcon icon={siHbo} /></button></div>
        </div>}

        {tab === "control" && <>
        <div className="dpad">
          <HoldButton className="up" label="Arriba" remoteKey="up" sendKey={key}><ArrowUp /></HoldButton>
          <HoldButton className="left" label="Izquierda" remoteKey="left" sendKey={key}><ArrowLeft /></HoldButton>
          <HoldButton className="ok" label="Aceptar" remoteKey="ok" sendKey={key}>OK</HoldButton>
          <HoldButton className="right" label="Derecha" remoteKey="right" sendKey={key}><ArrowRight /></HoldButton>
          <HoldButton className="down" label="Abajo" remoteKey="down" sendKey={key}><ArrowDown /></HoldButton>
        </div>

        <div className="quick-row">
          <KeyButton label="Volver" icon={<RotateCcw />} onPress={() => key("back")} />
          <KeyButton label="Inicio" icon={<Home />} onPress={() => key("home")} />
          <KeyButton label="Pausa" icon={<Play />} onPress={() => key("playPause")} />
        </div>

        <div className="volume">
          <button onClick={() => key("volumeDown")} aria-label="Bajar volumen"><Volume1 /><small>Bajar</small></button>
          <button onClick={() => key("mute")} aria-label="Silenciar"><VolumeX /><small>Silencio</small></button>
          <button onClick={() => key("volumeUp")} aria-label="Subir volumen"><Volume2 /><small>Subir</small></button>
        </div>
        </>}

        {tab === "channels" && <div className="channel-panel">
          <div className="favorites">
            <div className="favorites-heading"><span><Star /> Favoritos</span>{editingFavorites ? <button className="edit-favorites cancel" onClick={() => setEditingFavorites(false)} aria-label="Cancelar edición"><X /></button> : <button className="edit-favorites" onClick={startEditingFavorites}><Pencil /> Editar</button>}</div>
            {editingFavorites ? <div className="favorites-editor"><input value={favoritesDraft} onChange={(event) => setFavoritesDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveFavorites(); }} inputMode="numeric" placeholder="10, 12, 101…" autoFocus /><button onClick={saveFavorites}><Check /> Guardar</button></div> : <div className="favorite-list">{favorites.length ? favorites.map((channel) => <button key={channel} onClick={() => tuneChannel(channel)}>{channel}</button>) : <button className="empty-favorites" onClick={startEditingFavorites}>Agregar canales</button>}</div>}
          </div>
          <div className="number-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} onClick={() => key(`digit${digit}`)}>{digit}</button>)}
            <button className="number-volume" onClick={() => key("volumeDown")} aria-label="Bajar volumen"><Volume1 /><span>Bajar</span></button>
            <button className="zero" onClick={() => key("digit0")}>0</button>
            <button className="number-volume" onClick={() => key("volumeUp")} aria-label="Subir volumen"><Volume2 /><span>Subir</span></button>
          </div>
          <div className="channel-controls">
            <button onClick={() => key("channelDown")}><ChevronDown /><span>Canal −</span></button>
            <button onClick={() => key("previousChannel")}><RotateCcw /><span>Anterior</span></button>
            <button onClick={() => key("channelUp")}><ChevronUp /><span>Canal +</span></button>
          </div>
        </div>}

        {tab === "apps" && <div className="app-search">
          <div className="section-title"><AppWindow /><div><h2>Buscar en una app</h2><p>Abrí directamente tus resultados</p></div></div>
          <div className="search-row">
            <select value={searchApp} onChange={(event) => setSearchApp(event.target.value)} aria-label="Aplicación"><option value="youtube">YouTube</option><option value="netflix">Netflix</option><option value="prime">Prime Video</option><option value="apple">Apple TV</option><option value="disney">Disney+</option><option value="hbo">HBO Max</option></select>
            <input value={appSearch} onChange={(event) => setAppSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openSearch(); }} placeholder="Película, serie o video" />
            <button onClick={openSearch} disabled={!appSearch.trim()} aria-label="Buscar"><Search /></button>
          </div>
        </div>}

        {tab === "keyboard" && <div className="keyboard">
          <div className="section-title"><Keyboard /><div><h2>Escribí desde el celular</h2><p>El texto aparece en vivo en el campo abierto</p></div></div>
          <textarea value={text} onChange={(event) => { const value = event.target.value; setText(value); send({ type: "text", value }); }} placeholder="Abrí un buscador en el deco y escribí acá…" rows={3} />
          <div className="keyboard-actions"><button className="delete" onClick={() => { setText(""); send({ type: "clear-text" }); }}><Delete /> Limpiar campo</button><button onClick={() => key("ok")} disabled={!text.trim()}><Search /> Aceptar</button></div>
        </div>}
        </div>
      </section>

      {connected && <nav className="bottom-nav" aria-label="Secciones del control">
        <button aria-current={tab === "channels" ? "page" : undefined} className={tab === "channels" ? "active" : ""} onClick={() => setTab("channels")}><Grid3X3 /><span>Canales</span></button>
        <button aria-current={tab === "control" ? "page" : undefined} className={tab === "control" ? "active" : ""} onClick={() => setTab("control")}><Gamepad2 /><span>Control</span></button>
        <button aria-current={tab === "apps" ? "page" : undefined} className={tab === "apps" ? "active" : ""} onClick={() => setTab("apps")}><AppWindow /><span>Apps</span></button>
        <button aria-current={tab === "keyboard" ? "page" : undefined} className={tab === "keyboard" ? "active" : ""} onClick={() => setTab("keyboard")}><Keyboard /><span>Teclado</span></button>
      </nav>}

      {connected && <button className="disconnect" onClick={() => send({ type: "disconnect" })}>Desconectar de {host}</button>}
      <footer>Funciona localmente · sin nube · sin enviar tus datos</footer>
    </main>
  );
}
