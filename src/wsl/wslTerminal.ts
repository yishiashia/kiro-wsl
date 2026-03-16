import * as vscode from 'vscode';

export function createWSLTerminal(distro: string, cwd?: string): vscode.Terminal {
    const shellArgs = ['-d', distro];
    if (cwd) {
        shellArgs.push('--cd', cwd);
    }

    return vscode.window.createTerminal({
        name: `WSL: ${distro}`,
        shellPath: 'wsl.exe',
        shellArgs,
    });
}
