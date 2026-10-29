#!/bin/sh
set -eu

PLIST="$HOME/Library/LaunchAgents/com.flow-remote.server.plist"
launchctl bootout "gui/$UID/com.flow-remote.server" 2>/dev/null || true
rm -f "$PLIST"
echo "Inicio automático desinstalado."
