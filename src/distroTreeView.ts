import * as vscode from 'vscode';
import { WSLManager, WSLDistro } from './wsl/wslManager';
import { RemoteLocationHistory } from './remoteLocationHistory';
import { Logger } from './common/logger';

type WSLTreeItem = DistroTreeItem | RecentFolderTreeItem;

class DistroTreeItem extends vscode.TreeItem {
    constructor(public readonly distro: WSLDistro) {
        super(
            distro.name + (distro.isDefault ? ' (Default)' : ''),
            vscode.TreeItemCollapsibleState.Collapsed
        );
        this.contextValue = 'distro';
        this.description = distro.state === 'Running' ? '● Running' : '○ Stopped';
        this.iconPath = new vscode.ThemeIcon(
            distro.state === 'Running' ? 'vm-running' : 'vm'
        );
    }
}

class RecentFolderTreeItem extends vscode.TreeItem {
    constructor(
        public readonly distroName: string,
        public readonly folderPath: string
    ) {
        super(folderPath, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'recentFolder';
        this.description = '(recent)';
        this.iconPath = new vscode.ThemeIcon('folder');
        this.command = {
            command: 'vscode.newWindow',
            title: 'Open Folder in WSL',
            arguments: [{
                remoteAuthority: `wsl+${encodeURIComponent(distroName)}`,
                folderUri: vscode.Uri.from({
                    scheme: 'vscode-remote',
                    authority: `wsl+${encodeURIComponent(distroName)}`,
                    path: folderPath,
                }),
            }],
        };
    }
}

export class WSLTreeDataProvider implements vscode.TreeDataProvider<WSLTreeItem> {
    readonly _onDidChangeTreeData = new vscode.EventEmitter<WSLTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly wslManager: WSLManager;
    private readonly history: RemoteLocationHistory;
    private readonly logger: Logger;

    constructor(wslManager: WSLManager, history: RemoteLocationHistory, logger: Logger) {
        this.wslManager = wslManager;
        this.history = history;
        this.logger = logger;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: WSLTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WSLTreeItem): Promise<WSLTreeItem[]> {
        if (!element) {
            // Root: list distros
            try {
                const distros = await this.wslManager.listDistros();
                return distros.map(d => new DistroTreeItem(d));
            } catch (err) {
                this.logger.error('Failed to list WSL distros', err);
                return [];
            }
        }

        if (element instanceof DistroTreeItem) {
            // Children: recent folders for this distro
            const folders = this.history.getHistory(element.distro.name);
            return folders.map(f => new RecentFolderTreeItem(element.distro.name, f));
        }

        return [];
    }
}

export function registerTreeView(
    context: vscode.ExtensionContext,
    wslManager: WSLManager,
    history: RemoteLocationHistory,
    logger: Logger
): WSLTreeDataProvider {
    const treeDataProvider = new WSLTreeDataProvider(wslManager, history, logger);

    const treeView = vscode.window.createTreeView('wslTargets', {
        treeDataProvider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);
    context.subscriptions.push(treeDataProvider._onDidChangeTreeData);

    return treeDataProvider;
}
