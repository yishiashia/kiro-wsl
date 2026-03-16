import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface IServerConfig {
    version: string;
    commit: string;
    quality: string;
    serverApplicationName: string;
    serverDataFolderName: string;
    serverDownloadUrlTemplate: string;
}

const DEFAULT_DOWNLOAD_URL_TEMPLATE =
    'https://update.kiro.dev/commit:${commit}/server-linux-${arch}/stable';

export function getServerConfig(): IServerConfig {
    const productJsonPath = path.join(vscode.env.appRoot, 'product.json');

    let productJson: Record<string, unknown>;
    try {
        const content = fs.readFileSync(productJsonPath, 'utf-8');
        productJson = JSON.parse(content);
    } catch (err) {
        throw new Error(`Failed to read product.json at ${productJsonPath}: ${err}`);
    }

    const commit = productJson['commit'];
    if (typeof commit !== 'string' || !commit) {
        throw new Error('product.json is missing required field: commit');
    }

    const version = productJson['version'];
    if (typeof version !== 'string' || !version) {
        throw new Error('product.json is missing required field: version');
    }

    const quality = typeof productJson['quality'] === 'string' ? productJson['quality'] : 'stable';

    const serverApplicationName = productJson['serverApplicationName'];
    if (typeof serverApplicationName !== 'string' || !serverApplicationName) {
        throw new Error('product.json is missing required field: serverApplicationName');
    }

    const serverDataFolderName = typeof productJson['serverDataFolderName'] === 'string'
        ? productJson['serverDataFolderName']
        : '.kiro-server';

    // User setting overrides product.json
    const userTemplate = vscode.workspace
        .getConfiguration('remote.WSL')
        .get<string>('serverDownloadUrlTemplate');

    const productTemplate = typeof productJson['serverDownloadUrlTemplate'] === 'string'
        ? productJson['serverDownloadUrlTemplate']
        : '';

    const serverDownloadUrlTemplate = userTemplate || productTemplate || DEFAULT_DOWNLOAD_URL_TEMPLATE;

    return {
        version,
        commit,
        quality,
        serverApplicationName,
        serverDataFolderName,
        serverDownloadUrlTemplate,
    };
}

export function resolveDownloadUrl(config: IServerConfig, arch: string): string {
    return config.serverDownloadUrlTemplate
        .replace(/\$\{version\}/g, config.version)
        .replace(/\$\{commit\}/g, config.commit)
        .replace(/\$\{quality\}/g, config.quality)
        .replace(/\$\{arch\}/g, arch)
        .replace(/\$\{os\}/g, 'linux');
}
