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
            `Kiro WSL: Failed to list WSL distributions. Is WSL installed? (${err instanceof Error ? err.message : err})`,
            'Show Log'
        ).then(action => {
            if (action === 'Show Log') {
                vscode.commands.executeCommand('kirowsl.showLog');
            }
        }, () => { /* dialog dismissed */ });
        return undefined;
    }

    if (distros.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL distributions found. Install a distribution from the Microsoft Store.'
        );
        return undefined;
    }

    // Filter out confirmed WSL1 distros — tunnel logic requires WSL2
    // Allow undefined version through but require explicit user confirmation
    const eligible = distros.filter(d => d.version !== 1);
    if (eligible.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL 2 distributions found. Kiro WSL requires WSL 2. Convert existing distributions with: wsl --set-version <distro> 2'
        );
        return undefined;
    }

    const items = eligible.map(d => ({
        label: d.name + (d.isDefault ? ' (Default)' : ''),
        description: `${d.state}` + (d.version != null ? ` · WSL ${d.version}` : ' · version unknown'),
        distro: d,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a WSL distribution',
    });

    if (!picked) {
        return undefined;
    }

    if (picked.distro.version == null) {
        const action = await vscode.window.showWarningMessage(
            `Kiro WSL: The WSL version for "${picked.distro.name}" could not be determined. ` +
            'This extension requires WSL 2. Continue anyway?',
            'Continue',
            'Cancel'
        );
        if (action !== 'Continue') {
            return undefined;
        }
    }

    return picked.distro;
}

async function getDefaultDistro(wslManager: WSLManager, logger: Logger): Promise<WSLDistro | undefined> {
    let distros: WSLDistro[];
    try {
        distros = await wslManager.listDistros();
    } catch (err) {
        logger.error('Failed to list WSL distributions', err);
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to list WSL distributions. Is WSL installed? (${err instanceof Error ? err.message : err})`,
            'Show Log'
        ).then(action => {
            if (action === 'Show Log') {
                vscode.commands.executeCommand('kirowsl.showLog');
            }
        }, () => { /* dialog dismissed */ });
        return undefined;
    }

    if (distros.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL distributions found. Install a distribution from the Microsoft Store.'
        );
        return undefined;
    }

    // Filter out confirmed WSL1 distros — allow undefined version through (warn before use)
    const eligible = distros.filter(d => d.version !== 1);
    if (eligible.length === 0) {
        vscode.window.showErrorMessage(
            'No WSL 2 distributions found. Kiro WSL requires WSL 2. Convert existing distributions with: wsl --set-version <distro> 2'
        );
        return undefined;
    }

    const picked = eligible.find(d => d.isDefault) || eligible[0];
    if (!picked) {
        return undefined;
    }

    if (picked.version == null) {
        const action = await vscode.window.showWarningMessage(
            `Kiro WSL: The WSL version for "${picked.name}" could not be determined. ` +
            'This extension requires WSL 2. Continue anyway?',
            'Continue',
            'Cancel'
        );
        if (action !== 'Continue') {
            return undefined;
        }
    }

    return picked;
}

async function connectToDistro(
    distroName: string,
    newWindow: boolean
): Promise<void> {
    const authority = `wsl+${encodeURIComponent(distroName)}`;
    try {
        await vscode.commands.executeCommand('vscode.newWindow', {
            remoteAuthority: authority,
            reuseWindow: !newWindow,
        });
    } catch (err) {
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to open WSL window for ${distroName}. ` +
            `${err instanceof Error ? err.message : String(err)}`
        );
        throw err;
    }
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
