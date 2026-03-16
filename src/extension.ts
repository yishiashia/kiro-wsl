import * as vscode from 'vscode';
import { isWindows } from './common/platform';
import { Logger } from './common/logger';
import { ensureProposedApiEnabled } from './common/argvSetup';
import { WSLManager } from './wsl/wslManager';
import { RemoteWSLResolver } from './authResolver';
import { registerCommands } from './commands';
import { RemoteLocationHistory } from './remoteLocationHistory';
import { registerTreeView } from './distroTreeView';

export function activate(context: vscode.ExtensionContext): void {
    if (!isWindows()) {
        // Extension only works on Windows with WSL
        return;
    }

    const logger = new Logger('Kiro WSL');
    context.subscriptions.push({ dispose: () => logger.dispose() });

    logger.info('Kiro WSL extension activating...');

    // Check if proposed API is available; if not, auto-patch argv.json
    const registerResolver = (vscode.workspace as any).registerRemoteAuthorityResolver;
    if (typeof registerResolver !== 'function') {
        logger.warn('Proposed API not available. Attempting to enable via argv.json...');
        ensureProposedApiEnabled(logger);
        return;
    }

    const wslManager = new WSLManager(logger);
    const resolver = new RemoteWSLResolver(wslManager, logger);

    // Register the remote authority resolver for "wsl" scheme
    const resolverDisposable = registerResolver.call(vscode.workspace, 'wsl', resolver);
    if (resolverDisposable) {
        context.subscriptions.push(resolverDisposable);
    }

    // Register commands
    registerCommands(context, wslManager, logger);

    // Register tree view
    const history = new RemoteLocationHistory(context.globalState);
    registerTreeView(context, wslManager, history, logger);

    // Track opened WSL folders in history
    const remoteAuthority = (vscode.env as any).remoteAuthority as string | undefined;
    if (remoteAuthority?.startsWith('wsl+')) {
        const distro = decodeURIComponent(remoteAuthority.substring(4));
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            for (const folder of folders) {
                history.addLocation(distro, folder.uri.path);
            }
        }
    }

    logger.info('Kiro WSL extension activated.');
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
