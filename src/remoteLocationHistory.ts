import * as vscode from 'vscode';

const HISTORY_KEY = 'kirowsl.locationHistory';
const MAX_HISTORY = 10;

interface HistoryData {
    [distro: string]: string[];
}

export class RemoteLocationHistory {
    private readonly globalState: vscode.Memento;

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
    }

    getHistory(distro: string): string[] {
        const data = this.getData();
        return data[distro] || [];
    }

    async addLocation(distro: string, folderPath: string): Promise<void> {
        const data = this.getData();
        const history = data[distro] || [];

        // Remove duplicate if exists
        const index = history.indexOf(folderPath);
        if (index !== -1) {
            history.splice(index, 1);
        }

        // Add to front
        history.unshift(folderPath);

        // Trim to max
        if (history.length > MAX_HISTORY) {
            history.length = MAX_HISTORY;
        }

        data[distro] = history;
        await this.globalState.update(HISTORY_KEY, data);
    }

    async removeLocation(distro: string, folderPath: string): Promise<void> {
        const data = this.getData();
        const history = data[distro] || [];
        const index = history.indexOf(folderPath);
        if (index !== -1) {
            history.splice(index, 1);
            data[distro] = history;
            await this.globalState.update(HISTORY_KEY, data);
        }
    }

    private getData(): HistoryData {
        return this.globalState.get<HistoryData>(HISTORY_KEY, {});
    }
}
