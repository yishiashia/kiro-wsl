import * as vscode from 'vscode';
import { WSLManager, WSLDistro } from './wsl/wslManager';
import { Logger } from './common/logger';

async function pickDistro(wslManager: WSLManager, logger: Logger): Promise<WSLDistro | undefined> {
    let distros: WSLDistro[];
    try {
        distros = await wslManager.listDistros();
    } catch (err) {
        logger.error('Failed to list WSL distributions', err);
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to list WSL distributions. Is WSL installed? (${err instanceof Error ? err.message : err})`
        );
        return undefined;
    }

    if (distros.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL distributions found. Install a distribution from the Microsoft Store.'
        );
        return undefined;
    }

    const items = distros.map(d => ({
        label: d.name + (d.isDefault ? ' (Default)' : ''),
        description: `${d.state} · WSL ${d.version}`,
        distro: d,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a WSL distribution',
    });

    return picked?.distro;
}

async function getDefaultDistro(wslManager: WSLManager, logger: Logger): Promise<WSLDistro | undefined> {
    let distros: WSLDistro[];
    try {
        distros = await wslManager.listDistros();
    } catch (err) {
        logger.error('Failed to list WSL distributions', err);
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to list WSL distributions. Is WSL installed? (${err instanceof Error ? err.message : err})`
        );
        return undefined;
    }

    if (distros.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL distributions found. Install a distribution from the Microsoft Store.'
        );
        return undefined;
    }

    return distros.find(d => d.isDefault) || distros[0];
}

async function connectToDistro(
    distroName: string,
    newWindow: boolean
): Promise<void> {
    const authority = `wsl+${encodeURIComponent(distroName)}`;
    await vscode.commands.executeCommand('vscode.newWindow', {
        remoteAuthority: authority,
        reuseWindow: !newWindow,
    });
}

export function registerCommands(
    context: vscode.ExtensionContext,
    wslManager: WSLManager,
    logger: Logger
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('kirowsl.connect', async () => {
            logger.info('Command: kirowsl.connect');
            const distro = await getDefaultDistro(wslManager, logger);
            if (distro) {
                await connectToDistro(distro.name, false);
            }
        }),

        vscode.commands.registerCommand('kirowsl.connectInNewWindow', async () => {
            logger.info('Command: kirowsl.connectInNewWindow');
            const distro = await getDefaultDistro(wslManager, logger);
            if (distro) {
                await connectToDistro(distro.name, true);
            }
        }),

        vscode.commands.registerCommand('kirowsl.connectUsingDistro', async () => {
            logger.info('Command: kirowsl.connectUsingDistro');
            const distro = await pickDistro(wslManager, logger);
            if (distro) {
                await connectToDistro(distro.name, false);
            }
        }),

        vscode.commands.registerCommand('kirowsl.connectUsingDistroInNewWindow', async () => {
            logger.info('Command: kirowsl.connectUsingDistroInNewWindow');
            const distro = await pickDistro(wslManager, logger);
            if (distro) {
                await connectToDistro(distro.name, true);
            }
        }),

        vscode.commands.registerCommand('kirowsl.showLog', () => {
            logger.show();
        }),
    );
}
