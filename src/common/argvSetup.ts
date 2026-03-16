import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './logger';

const EXTENSION_ID = 'yishiashia.kiro-wsl';

/**
 * Get the path to Kiro's argv.json.
 * Kiro stores it at ~/.kiro/argv.json (dataFolderName from product.json is ".kiro").
 */
function getArgvJsonPath(): string {
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(homeDir, '.kiro', 'argv.json');
}

/**
 * Read argv.json, stripping single-line comments (// ...) that Kiro puts in the file.
 */
function readArgvJson(filePath: string): Record<string, unknown> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    // Strip single-line comments (// ...) but not inside strings
    const stripped = raw.replace(/^\s*\/\/.*$/gm, '');
    return JSON.parse(stripped);
}

/**
 * Write back argv.json preserving the comment header from the original file.
 */
function writeArgvJson(filePath: string, data: Record<string, unknown>): void {
    // Read original to preserve the comment header
    let header = '';
    try {
        const original = fs.readFileSync(filePath, 'utf-8');
        const lines = original.split('\n');
        const headerLines: string[] = [];
        for (const line of lines) {
            if (line.trim().startsWith('//') || line.trim() === '') {
                headerLines.push(line);
            } else {
                break;
            }
        }
        if (headerLines.length > 0) {
            header = headerLines.join('\n') + '\n';
        }
    } catch {
        // ignore
    }

    const json = JSON.stringify(data, null, '\t');
    fs.writeFileSync(filePath, header + json + '\n', 'utf-8');
}

/**
 * Ensure that our extension ID is listed in argv.json's "enable-proposed-api".
 * Returns true if argv.json was modified (user needs to restart).
 */
export async function ensureProposedApiEnabled(logger: Logger): Promise<boolean> {
    const argvPath = getArgvJsonPath();

    if (!fs.existsSync(argvPath)) {
        logger.warn(`argv.json not found at ${argvPath}`);
        return false;
    }

    try {
        const data = readArgvJson(argvPath);
        let list = data['enable-proposed-api'];

        if (!Array.isArray(list)) {
            list = [];
        }

        if ((list as string[]).includes(EXTENSION_ID)) {
            logger.info('Proposed API already enabled for this extension.');
            return false;
        }

        (list as string[]).push(EXTENSION_ID);
        data['enable-proposed-api'] = list;
        writeArgvJson(argvPath, data);

        logger.info(`Added ${EXTENSION_ID} to enable-proposed-api in argv.json`);

        const action = await vscode.window.showInformationMessage(
            'Kiro WSL: Proposed API has been enabled. Please restart Kiro to activate WSL remote support.',
            'Restart Now'
        );

        if (action === 'Restart Now') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

        return true;
    } catch (err) {
        logger.error('Failed to update argv.json', err);
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to auto-configure argv.json. Please manually add "${EXTENSION_ID}" to "enable-proposed-api" in ${argvPath}`
        );
        return false;
    }
}
