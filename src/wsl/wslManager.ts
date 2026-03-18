import * as cp from 'child_process';
import * as vscode from 'vscode';
import { Logger } from '../common/logger';

export interface WSLDistro {
    name: string;
    state: 'Running' | 'Stopped' | 'Installing';
    version: 1 | 2 | undefined;
    isDefault: boolean;
}

export interface ExecResult {
    stdout: string;
    stderr: string;
    onStdoutData: vscode.Event<string>;
    exitPromise: Promise<number>;
}

export class WSLManager {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async listDistros(): Promise<WSLDistro[]> {
        this.logger.info('Listing WSL distributions...');

        // Use -l -q to get distro names — immune to Windows locale issues
        const namesOutput = await this.runWslCommand(['-l', '-q']);
        const names = namesOutput
            .split('\n')
            .map(l => l.replace(/\0/g, '').trim())
            .filter(l => l.length > 0);

        if (names.length === 0) {
            return [];
        }

        // Parse --list --verbose once for default marker, state hint, and version.
        // State text may be localized (e.g. "執行中" on zh-TW Windows) — we don't
        // rely on it for Running/Stopped (that comes from --running below), but we
        // do preserve it to detect Installing distros.
        // Parse --list --verbose using the known distro names from -l -q to avoid
        // locale issues with multi-word STATE columns (e.g. "正在 執行" on zh-TW).
        // Strategy: for each verbose line, find which known name it contains, then
        // parse version (always last digit token) and state (everything between name and version).
        const nameSet = new Set(names);
        const infoMap = new Map<string, { isDefault: boolean; stateHint: string; version: 1 | 2 | undefined }>();
        try {
            const verboseOutput = await this.runWslCommand(['--list', '--verbose']);
            const lines = verboseOutput.split('\n').map(l => l.replace(/\0/g, ''));
            // Skip header (first non-empty line)
            for (let i = 1; i < lines.length; i++) {
                const raw = lines[i];
                if (!raw.trim()) { continue; }

                const isDefault = raw.trimStart().startsWith('*');
                const cleaned = isDefault ? raw.trimStart().substring(1).trim() : raw.trim();

                // VERSION is always the last token (a single digit)
                const lastSpaceIdx = cleaned.lastIndexOf(' ');
                if (lastSpaceIdx === -1) { continue; }
                const verStr = cleaned.substring(lastSpaceIdx + 1).trim();
                const ver = parseInt(verStr, 10);
                const beforeVersion = cleaned.substring(0, lastSpaceIdx).trim();

                // Match against known distro names (from -l -q) to split name from state.
                // Try longest match first in case names overlap.
                let matchedName: string | undefined;
                for (const name of nameSet) {
                    if (beforeVersion.startsWith(name) &&
                        (!matchedName || name.length > matchedName.length)) {
                        matchedName = name;
                    }
                }

                if (!matchedName) { continue; }
                const stateHint = beforeVersion.substring(matchedName.length).trim();

                infoMap.set(matchedName, {
                    isDefault,
                    stateHint,
                    version: (ver === 1 || ver === 2) ? ver : undefined,
                });
            }
        } catch {
            this.logger.warn('Failed to parse --list --verbose; falling back to names only');
        }

        // Also get running distro names for reliable state detection
        const runningNames = new Set<string>();
        try {
            const runningOutput = await this.runWslCommand(['-l', '--running', '-q']);
            for (const line of runningOutput.split('\n')) {
                const name = line.replace(/\0/g, '').trim();
                if (name) { runningNames.add(name); }
            }
        } catch {
            // --running may not be available on older WSL; fall back to verbose state
        }

        return names.map(name => {
            const info = infoMap.get(name);
            // Prefer --running for state detection (no localization issue)
            const isRunning = runningNames.has(name);
            let state: WSLDistro['state'];
            if (isRunning) {
                state = 'Running';
            } else if (info?.stateHint === 'Installing') {
                // Preserve Installing state from verbose output
                state = 'Installing';
            } else {
                state = 'Stopped';
            }
            return {
                name,
                state,
                version: info?.version,
                isDefault: info?.isDefault ?? false,
            };
        });
    }

    // Kept for unit tests
    static parseDistroList(output: string): WSLDistro[] {
        const lines = output.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length <= 1) {
            return [];
        }

        const distros: WSLDistro[] = [];
        for (let i = 1; i < lines.length; i++) {
            const parsed = WSLManager.parseDistroLine(lines[i]);
            if (parsed) {
                distros.push(parsed);
            }
        }
        return distros;
    }

    static parseDistroLine(line: string): WSLDistro | null {
        const isDefault = line.startsWith('*');
        const cleaned = isDefault ? line.substring(1).trim() : line.trim();

        if (!cleaned) {
            return null;
        }

        const parts = cleaned.split(/\s+/);
        if (parts.length < 3) {
            return null;
        }

        const version = parseInt(parts[parts.length - 1], 10);
        const state = parts[parts.length - 2] as WSLDistro['state'];
        const name = parts.slice(0, parts.length - 2).join(' ');

        if (!['Running', 'Stopped', 'Installing'].includes(state)) {
            return null;
        }

        if (version !== 1 && version !== 2) {
            return null;
        }

        return { name, state, version, isDefault };
    }

    exec(command: string, args: string[], distro: string): ExecResult {
        const wslArgs = ['-d', distro, '--', command, ...args];
        this.logger.info(`Executing in WSL (${distro}): ${command} ${args.join(' ')}`);

        const proc = cp.spawn('wsl.exe', wslArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        const stdoutEmitter = new vscode.EventEmitter<string>();

        proc.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            stdoutEmitter.fire(text);
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        const exitPromise = new Promise<number>((resolve, reject) => {
            proc.on('close', (code) => {
                resolve(code ?? 1);
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });

        return {
            get stdout() { return stdout; },
            get stderr() { return stderr; },
            onStdoutData: stdoutEmitter.event,
            exitPromise,
        };
    }

    /**
     * Execute a bash script inside WSL by piping it via stdin.
     * This avoids Windows command-line quoting issues with complex scripts.
     */
    execScript(script: string, distro: string): ExecResult {
        const wslArgs = ['-d', distro, '--', 'bash', '-s'];
        this.logger.info(`Executing script via stdin in WSL (${distro})`);

        const proc = cp.spawn('wsl.exe', wslArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Write script to stdin and close it
        proc.stdin.write(script);
        proc.stdin.end();

        let stdout = '';
        let stderr = '';

        const stdoutEmitter = new vscode.EventEmitter<string>();

        proc.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            stdoutEmitter.fire(text);
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        const exitPromise = new Promise<number>((resolve, reject) => {
            proc.on('close', (code) => {
                resolve(code ?? 1);
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });

        return {
            get stdout() { return stdout; },
            get stderr() { return stderr; },
            onStdoutData: stdoutEmitter.event,
            exitPromise,
        };
    }

    private runWslCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.execFile('wsl.exe', args, { encoding: 'utf16le' }, (error, stdout, stderr) => {
                if (error) {
                    this.logger.error(`wsl.exe ${args.join(' ')} failed`, error);
                    reject(error);
                    return;
                }
                if (stderr) {
                    this.logger.warn(`wsl.exe stderr: ${stderr}`);
                }
                resolve(stdout);
            });
        });
    }
}
