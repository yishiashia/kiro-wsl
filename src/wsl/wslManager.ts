import * as cp from 'child_process';
import * as vscode from 'vscode';
import { Logger } from '../common/logger';

export interface WSLDistro {
    name: string;
    state: 'Running' | 'Stopped' | 'Installing';
    version: 1 | 2;
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

        // Use -l -q to get names only — avoids localization issues with --verbose state strings
        const namesOutput = await this.runWslCommand(['-l', '-q']);
        const names = namesOutput
            .split('\n')
            .map(l => l.replace(/\0/g, '').trim())  // strip NUL chars from UTF-16 output
            .filter(l => l.length > 0);

        if (names.length === 0) {
            return [];
        }

        // Detect default distro name from --list --verbose (just column 1, any locale)
        let defaultName = '';
        try {
            const verboseOutput = await this.runWslCommand(['--list', '--verbose']);
            for (const line of verboseOutput.split('\n')) {
                if (line.trimStart().startsWith('*')) {
                    // default marker — grab the first word after the asterisk
                    const parts = line.replace(/\0/g, '').trimStart().substring(1).trim().split(/\s+/);
                    if (parts[0]) {
                        defaultName = parts[0];
                    }
                    break;
                }
            }
        } catch {
            // if verbose fails, continue without default detection
        }

        // Probe each distro's running state and WSL version
        const distros: WSLDistro[] = await Promise.all(names.map(async (name) => {
            let state: WSLDistro['state'] = 'Stopped';
            let version: 1 | 2 = 2;

            try {
                // wsl -d <name> --status exits 0 and prints WSL version if running/available
                const statusOut = await this.runWslCommand(['-d', name, '--exec', 'echo', 'ok']);
                if (statusOut.includes('ok')) {
                    state = 'Running';
                }
            } catch {
                state = 'Stopped';
            }

            try {
                const infoOut = await this.runWslCommand(['--list', '--verbose']);
                for (const line of infoOut.split('\n')) {
                    const clean = line.replace(/\0/g, '').replace(/^\s*\*?\s*/, '');
                    if (clean.startsWith(name)) {
                        const parts = clean.trim().split(/\s+/);
                        const v = parseInt(parts[parts.length - 1], 10);
                        if (v === 1 || v === 2) {
                            version = v;
                        }
                        break;
                    }
                }
            } catch {
                // default to version 2
            }

            return { name, state, version, isDefault: name === defaultName };
        }));

        return distros;
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
