import * as vscode from 'vscode';
import { WSLManager, WSLDistro } from './wsl/wslManager';
import { Logger } from './common/logger';

async function pickDistro(wslManager: WSLManager): Promise<WSLDistro | undefined> {
    const distros = await wslManager.listDistros();

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

function getDefaultDistro(distros: WSLDistro[]): WSLDistro | undefined {
    return distros.find(d => d.isDefault) || distros[0];
}

async function connectToDistro(
    wslManager: WSLManager,
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
            const distros = await wslManager.listDistros();
            const defaultDistro = getDefaultDistro(distros);
            if (!defaultDistro) {
                vscode.window.showErrorMessage('No WSL distributions found.');
                return;
            }
            await connectToDistro(wslManager, defaultDistro.name, false);
        }),

        vscode.commands.registerCommand('kirowsl.connectInNewWindow', async () => {
            logger.info('Command: kirowsl.connectInNewWindow');
            const distros = await wslManager.listDistros();
            const defaultDistro = getDefaultDistro(distros);
            if (!defaultDistro) {
                vscode.window.showErrorMessage('No WSL distributions found.');
                return;
            }
            await connectToDistro(wslManager, defaultDistro.name, true);
        }),

        vscode.commands.registerCommand('kirowsl.connectUsingDistro', async () => {
            logger.info('Command: kirowsl.connectUsingDistro');
            const distro = await pickDistro(wslManager);
            if (distro) {
                await connectToDistro(wslManager, distro.name, false);
            }
        }),

        vscode.commands.registerCommand('kirowsl.connectUsingDistroInNewWindow', async () => {
            logger.info('Command: kirowsl.connectUsingDistroInNewWindow');
            const distro = await pickDistro(wslManager);
            if (distro) {
                await connectToDistro(wslManager, distro.name, true);
            }
        }),

        vscode.commands.registerCommand('kirowsl.showLog', () => {
            logger.show();
        }),
    );
}
