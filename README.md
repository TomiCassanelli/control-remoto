# Flow Remote

Control remoto web para un decodificador Android TV, pensado para el **Personal Flow Box fabricado por Skyworth Digital (identificador HP4CH25 en la etiqueta)**. La interfaz está hecha con React + TypeScript y el puente local con Node.js.

No instala nada en el deco, no usa ADB y no manda datos a una nube. Usa el protocolo oficial Android TV Remote v2 en la red local (mDNS, TLS mutuo y protobuf).

## Antes de empezar

- El deco y la computadora deben estar en la misma red local.
- El celular también debe estar en esa red Wi-Fi.
- Necesitás Node.js 20 o posterior en una computadora que quede encendida mientras usás el control.
- El firmware de Personal debe tener habilitado Android TV Remote Service. La app incluye un botón **Diagnosticar** para comprobarlo.

> Un navegador del celular no puede conectarse directamente a los puertos TLS/mDNS del deco. Por eso Node funciona como un puente estrictamente local.

## Uso rápido

```bash
npm install
npm run dev
```

En la computadora abrí `http://localhost:5173`. Desde el celular usá la IP local de la computadora, por ejemplo `http://192.168.1.20:5173`.

Para conocer esa IP:

```bash
# macOS, normalmente
ipconfig getifaddr en0

# Linux
hostname -I
```

La primera vez:

1. La app intenta detectar el Flow Box automáticamente: primero por mDNS y, si el deco no se anuncia, con una búsqueda acotada en la red Wi-Fi local. Si ninguno funciona, todavía podés ingresar su IP desde el diagnóstico.
2. Tocá **Conectar**.
3. La primera vez, copiá en la web el código de 6 caracteres que aparece en la TV.
4. Abrí un campo de búsqueda en Flow, YouTube u otra app y escribí desde el celular.

El certificado y el último dispositivo quedan en `.flow-remote/` con permisos locales restringidos. Desde entonces, sólo entrás a la PWA: encuentra el deco, reutiliza la vinculación y reconecta automáticamente. Todos los celulares que abran esta misma instalación comparten esa identidad; no se vincula cada PWA por separado.

Si cambia la IP del deco, la detección mDNS actualiza el destino y conserva el certificado. Sólo volverá a pedir el código si el Flow Box revoca o pierde la vinculación, se borra `.flow-remote/`, se restaura el deco, o se ejecuta otra instalación Node independiente.

## Encendido y apagado

El botón de encendido envía `KEYCODE_POWER`. En espera normal, el Flow Box suele mantener Android y la red activos, por lo que puede recibir la orden para despertar; si la conexión cae temporalmente, el servidor intenta restablecerla. Si el equipo entra en apagado profundo, pierde la red o se desenchufa, no puede despertarse por este protocolo IP. El comportamiento exacto depende del firmware instalado por Personal y conviene confirmarlo en el equipo físico.

## Uso estable

```bash
npm run build
npm start
```

Abrí `http://IP-DE-LA-COMPUTADORA:8787` desde el teléfono. Para detenerlo, presioná `Ctrl+C`.

Después podés usar **Agregar a pantalla de inicio** desde el navegador para abrirla como acceso directo. Al entrar, se conecta sola al último Flow Box vinculado. La instalación PWA completa mediante service worker requiere HTTPS; sobre una IP local HTTP, la disponibilidad depende del navegador.

## Si el deco no aparece

1. Buscá su IP en los ajustes del Flow Box e ingresala manualmente.
2. Tocá **Diagnosticar**. El control necesita los puertos TCP `6466` (remoto) y `6467` (vinculación).
3. Desactivá temporalmente aislamiento de clientes/AP isolation o una red Wi-Fi de invitados.
4. Confirmá que el firewall de la computadora permita Node y conexiones entrantes a `5173`/`8787`.
5. Si ambos puertos figuran cerrados, esa versión del firmware de Personal probablemente deshabilitó el servicio. En ese caso no se puede resolver sólo desde la web: haría falta otra vía soportada por el deco o habilitar el servicio desde sus ajustes.

## Alcance del teclado

El texto se envía en vivo mediante la interfaz IME nativa del protocolo, por lo que admite texto arbitrario, espacios y acentos. **Limpiar campo** reemplaza el contenido por un valor vacío. Algunas apps pueden usar un teclado propio y no aceptar entradas externas.

La pantalla principal también incluye accesos directos a YouTube y Netflix, más dos formas de navegación: touchpad por gestos o cruceta de botones. Los accesos usan Android App Links y requieren que cada aplicación esté instalada y registre su enlace en el firmware del Flow Box.

## Comandos

```bash
npm run dev        # servidor y web con recarga automática
npm run typecheck  # valida TypeScript
npm run build      # genera la versión de producción
npm start          # sirve todo en el puerto 8787
npm run autostart:install   # inicia el servidor al entrar en macOS
npm run autostart:uninstall # quita el inicio automático
```

Durante desarrollo se usa el puerto `8788`; el servicio automático estable permanece en `8787`. Así ambos pueden ejecutarse sin competir por el mismo puerto.

## Funciones del control

- Home, lista de aplicaciones y accesos a YouTube, Netflix, Prime Video, Apple TV y Disney+.
- Touchpad, cruceta con pulsación larga y respuesta háptica compatible con el navegador.
- Teclado numérico, canal anterior y cambio de canal.
- Búsqueda por aplicación y teclado Android TV en vivo.
- Estado de volumen/aplicación y sincronización entre celulares conectados.
