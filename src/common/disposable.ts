import * as vscode from 'vscode';

export class Disposable implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    protected register<T extends vscode.Disposable>(disposable: T): T {
        this.disposables.push(disposable);
        return disposable;
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
