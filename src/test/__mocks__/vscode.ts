// Minimal vscode mock for unit testing

export const window = {
    createOutputChannel: () => ({
        appendLine: () => {},
        show: () => {},
        dispose: () => {},
    }),
    showQuickPick: async () => undefined,
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    createTreeView: () => ({
        dispose: () => {},
    }),
};

export const workspace = {
    getConfiguration: () => ({
        get: () => undefined,
    }),
    workspaceFolders: undefined,
    registerRemoteAuthorityResolver: () => ({ dispose: () => {} }),
};

export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => {},
};

export const env = {
    appRoot: '',
    remoteAuthority: undefined,
};

export class EventEmitter {
    event = () => ({ dispose: () => {} });
    fire() {}
    dispose() {}
}

export class ThemeIcon {
    constructor(public id: string) {}
}

export class TreeItem {
    label?: string;
    collapsibleState?: number;
    contextValue?: string;
    description?: string;
    iconPath?: any;
    command?: any;

    constructor(label: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

export const Uri = {
    parse: (value: string) => ({ toString: () => value }),
    file: (path: string) => ({ toString: () => path, fsPath: path }),
};
