#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
NODE_BIN=$(command -v node)
AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST="$AGENT_DIR/com.flow-remote.server.plist"

mkdir -p "$AGENT_DIR" "$PROJECT_DIR/.flow-remote"
sed -e "s|__NODE__|$NODE_BIN|g" -e "s|__PROJECT__|$PROJECT_DIR|g" "$SCRIPT_DIR/com.flow-remote.server.plist.template" > "$PLIST"
launchctl bootout "gui/$UID/com.flow-remote.server" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl enable "gui/$UID/com.flow-remote.server"
launchctl kickstart -k "gui/$UID/com.flow-remote.server"
echo "Flow Remote se iniciará automáticamente al entrar en macOS."
