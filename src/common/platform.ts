import * as os from 'os';

export function isWindows(): boolean {
    return process.platform === 'win32';
}

export function getArchitecture(): string {
    const arch = os.arch();
    switch (arch) {
        case 'x64': return 'x64';
        case 'arm64': return 'arm64';
        default: return arch;
    }
}
