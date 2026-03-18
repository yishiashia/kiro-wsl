import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parse, ParseError } from 'jsonc-parser';
import { Logger } from './logger';

const EXTENSION_ID = 'yishiashia.kiro-wsl';

function getArgvJsonPath(): string {
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(homeDir, '.kiro', 'argv.json');
}

function readArgvJson(filePath: string): Record<string, unknown> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const errors: ParseError[] = [];
    const parsed = parse(raw, errors);
    if (errors.length > 0) {
        throw new Error(`Failed to parse argv.json: ${errors.map(e => `offset ${e.offset}`).join(', ')}`);
    }
    return parsed as Record<string, unknown>;
}

function writeArgvJson(filePath: string, data: Record<string, unknown>): void {
    // Preserve comment header lines from original file
    let header = '';
    try {
        const original = fs.readFileSync(filePath, 'utf-8');
        const headerLines: string[] = [];
        for (const line of original.split('\n')) {
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

export async function ensureProposedApiEnabled(logger: Logger): Promise<boolean> {
    const argvPath = getArgvJsonPath();

    try {
        // Auto-create argv.json if it doesn't exist
        if (!fs.existsSync(argvPath)) {
            logger.warn(`argv.json not found at ${argvPath}, offering to create it`);
            const action = await vscode.window.showWarningMessage(
                `Kiro WSL: Configuration file not found at ${argvPath}. Create it now to enable WSL remote support?`,
                'Create & Restart',
                'Cancel'
            );
            if (action !== 'Create & Restart') {
                return false;
            }
            const dir = path.dirname(argvPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const initialData = { 'enable-proposed-api': [EXTENSION_ID] };
            fs.writeFileSync(argvPath, JSON.stringify(initialData, null, '\t') + '\n', 'utf-8');
            logger.info(`Created argv.json with enable-proposed-api at ${argvPath}`);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
            return true;
        }
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
            'Kiro WSL: Configuration updated. Please restart Kiro to activate WSL remote support.',
            'Restart Now'
        );

        if (action === 'Restart Now') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

        return true;
    } catch (err) {
        logger.error('Failed to update argv.json', err);
        vscode.window.showErrorMessage(
            `Kiro WSL: Failed to auto-configure argv.json. ` +
            `Please manually add "${EXTENSION_ID}" to "enable-proposed-api" in ${argvPath}. ` +
            `Error: ${err instanceof Error ? err.message : err}`
        );
        return false;
    }
}
