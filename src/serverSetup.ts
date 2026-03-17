import { WSLManager } from './wsl/wslManager';
import { IServerConfig, resolveDownloadUrl } from './serverConfig';
import { Logger } from './common/logger';

export class ServerInstallError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ServerInstallError';
    }
}

export interface ServerConnection {
    host: string;
    port: number;
    connectionToken: string;
}

export function parseServerOutput(output: string): ServerConnection {
    // Format: exitCode::port::connectionToken::pid::logFile
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split('::');

    if (parts.length < 5) {
        throw new ServerInstallError(`Unexpected server output format: ${lastLine}`);
    }

    const [exitCode, portStr, connectionToken, , ] = parts;

    if (exitCode !== '0') {
        throw new ServerInstallError(`Server exited with code ${exitCode}`);
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port) || port <= 0) {
        throw new ServerInstallError(`Invalid port number: ${portStr}`);
    }

    if (!connectionToken) {
        throw new ServerInstallError('Missing connection token in server output');
    }

    return {
        host: '127.0.0.1',
        port,
        connectionToken,
    };
}

/**
 * Escape a value for safe embedding in a single-quoted bash string.
 * Replaces ' with '\'' (end quote, escaped quote, start quote).
 */
function bashEscape(value: string): string {
    return value.replace(/'/g, "'\\''");
}

export function generateInstallScript(config: IServerConfig): string {
    const { commit, serverApplicationName, serverDataFolderName } = config;

    // Resolve download URLs for both architectures in JS — no sed needed in bash
    const downloadUrlX64 = resolveDownloadUrl(config, 'x64');
    const downloadUrlArm64 = resolveDownloadUrl(config, 'arm64');

    // All values are injected as single-quoted bash variables to avoid any
    // interpretation by bash. The rest of the script uses only bash variables.
    return [
        '#!/bin/bash',
        'set -e',
        '',
        '# --- Values injected by extension (single-quoted, no bash interpretation) ---',
        `COMMIT='${bashEscape(commit)}'`,
        `SERVER_APP_NAME='${bashEscape(serverApplicationName)}'`,
        `DATA_FOLDER_NAME='${bashEscape(serverDataFolderName)}'`,
        `DOWNLOAD_URL_X64='${bashEscape(downloadUrlX64)}'`,
        `DOWNLOAD_URL_ARM64='${bashEscape(downloadUrlArm64)}'`,
        '',
        '# Detect architecture',
        'UARCH=$(uname -m)',
        'case "$UARCH" in',
        '    x86_64)  ARCH="x64"; DOWNLOAD_URL="$DOWNLOAD_URL_X64" ;;',
        '    aarch64) ARCH="arm64"; DOWNLOAD_URL="$DOWNLOAD_URL_ARM64" ;;',
        '    *)       echo "Unsupported architecture: $UARCH" >&2; exit 1 ;;',
        'esac',
        '',
        'SERVER_DIR="$HOME/$DATA_FOLDER_NAME/bin/$COMMIT"',
        'SERVER_BIN="$SERVER_DIR/bin/$SERVER_APP_NAME"',
        'TOKEN_FILE="$SERVER_DIR/token"',
        'PID_FILE="$SERVER_DIR/server.pid"',
        'LOG_FILE="$SERVER_DIR/server.log"',
        '',
        '# Check if server is already running',
        'if [ -f "$PID_FILE" ]; then',
        '    EXISTING_PID=$(cat "$PID_FILE")',
        '    if kill -0 "$EXISTING_PID" 2>/dev/null; then',
        '        if [ -f "$TOKEN_FILE" ] && [ -f "$LOG_FILE" ]; then',
        '            TOKEN=$(cat "$TOKEN_FILE")',
        '            PORT=$(sed -n \'s/.*Extension host agent listening on \\([0-9]\\+\\).*/\\1/p\' "$LOG_FILE" | tail -1)',
        '            if [ -n "$PORT" ] && [ -n "$TOKEN" ]; then',
        '                echo "0::${PORT}::${TOKEN}::${EXISTING_PID}::${LOG_FILE}"',
        '                exit 0',
        '            fi',
        '        fi',
        '    else',
        '        rm -f "$PID_FILE"',
        '    fi',
        'fi',
        '',
        '# Download and install if not present',
        'if [ ! -f "$SERVER_BIN" ]; then',
        '    mkdir -p "$SERVER_DIR"',
        '',
        '    echo "Downloading Kiro REH server from $DOWNLOAD_URL..." >&2',
        '',
        '    TARBALL="$SERVER_DIR/server.tar.gz"',
        '',
        '    if command -v curl >/dev/null 2>&1; then',
        '        curl -fsSL "$DOWNLOAD_URL" -o "$TARBALL"',
        '    elif command -v wget >/dev/null 2>&1; then',
        '        wget -q "$DOWNLOAD_URL" -O "$TARBALL"',
        '    else',
        '        echo "Neither curl nor wget found" >&2',
        '        echo "1:::::::::"',
        '        exit 1',
        '    fi',
        '',
        '    tar -xzf "$TARBALL" -C "$SERVER_DIR" --strip-components=1',
        '    rm -f "$TARBALL"',
        '    chmod +x "$SERVER_BIN"',
        'fi',
        '',
        '# Generate connection token',
        'TOKEN=$(head -c 32 /dev/urandom | base64 | tr -d "=/+" | head -c 32)',
        'echo "$TOKEN" > "$TOKEN_FILE"',
        '',
        '# Start server (detached from session so it survives after wsl.exe exits)',
        'setsid nohup "$SERVER_BIN" \\',
        '    --start-server \\',
        '    --host=127.0.0.1 \\',
        '    --port=0 \\',
        '    --connection-token-file="$TOKEN_FILE" \\',
        '    --telemetry-level=off \\',
        '    --enable-remote-auto-shutdown \\',
        '    --accept-server-license-terms \\',
        '    > "$LOG_FILE" 2>&1 &',
        '',
        'SERVER_PID=$!',
        'disown $SERVER_PID 2>/dev/null || true',
        'echo "$SERVER_PID" > "$PID_FILE"',
        '',
        '# Wait for server to start and report its port',
        'for i in $(seq 1 30); do',
        '    if [ -f "$LOG_FILE" ]; then',
        '        PORT=$(sed -n \'s/.*Extension host agent listening on \\([0-9]\\+\\).*/\\1/p\' "$LOG_FILE" | tail -1)',
        '        if [ -n "$PORT" ]; then',
        '            echo "0::${PORT}::${TOKEN}::${SERVER_PID}::${LOG_FILE}"',
        '            exit 0',
        '        fi',
        '    fi',
        '    sleep 1',
        'done',
        '',
        'echo "Timed out waiting for server to start" >&2',
        'echo "1:::::::::"',
        'exit 1',
    ].join('\n');
}

export async function installAndStartServer(
    wslManager: WSLManager,
    distro: string,
    config: IServerConfig,
    logger: Logger
): Promise<ServerConnection> {
    logger.info(`Installing/starting REH server in ${distro}...`);

    const script = generateInstallScript(config);
    logger.debug(`Generated install script:\n${script}`);

    // Use execScript to pipe via stdin — avoids Windows command-line quoting issues
    const result = wslManager.execScript(script, distro);

    let output = '';
    result.onStdoutData((data) => {
        output += data;
        logger.debug(`[WSL stdout] ${data.trim()}`);
    });

    const exitCode = await result.exitPromise;
    output = output || result.stdout;

    if (result.stderr) {
        logger.warn(`[WSL stderr] ${result.stderr}`);
    }

    logger.info(`WSL script exited with code ${exitCode}`);

    if (!output.trim()) {
        throw new ServerInstallError(
            `Server setup produced no output. Exit code: ${exitCode}. Stderr: ${result.stderr}`
        );
    }

    const connection = parseServerOutput(output);
    logger.info(`REH server running on ${connection.host}:${connection.port}`);
    return connection;
}
