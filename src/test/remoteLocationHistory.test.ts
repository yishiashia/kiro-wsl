import { expect } from 'chai';
import { RemoteLocationHistory } from '../remoteLocationHistory';

// Minimal Memento mock
class MockMemento {
    private store: Record<string, any> = {};

    get<T>(key: string, defaultValue: T): T {
        return key in this.store ? this.store[key] : defaultValue;
    }

    update(key: string, value: any): Thenable<void> {
        this.store[key] = value;
        return Promise.resolve();
    }

    keys(): readonly string[] {
        return Object.keys(this.store);
    }

    setKeysForSync(_keys: readonly string[]): void {
        // no-op
    }
}

describe('RemoteLocationHistory', () => {
    let memento: MockMemento;
    let history: RemoteLocationHistory;

    beforeEach(() => {
        memento = new MockMemento();
        history = new RemoteLocationHistory(memento as any);
    });

    it('should return empty array for unknown distro', () => {
        expect(history.getHistory('Ubuntu')).to.deep.equal([]);
    });

    it('should add location to empty history', async () => {
        await history.addLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/home/user/proj']);
    });

    it('should not add duplicate locations', async () => {
        await history.addLocation('Ubuntu', '/home/user/proj');
        await history.addLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/home/user/proj']);
    });

    it('should move duplicate to front on re-add', async () => {
        await history.addLocation('Ubuntu', '/home/user/a');
        await history.addLocation('Ubuntu', '/home/user/b');
        await history.addLocation('Ubuntu', '/home/user/a');
        expect(history.getHistory('Ubuntu')).to.deep.equal([
            '/home/user/a',
            '/home/user/b',
        ]);
    });

    it('should remove location', async () => {
        await history.addLocation('Ubuntu', '/home/user/proj');
        await history.removeLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal([]);
    });

    it('should maintain separate histories per distro', async () => {
        await history.addLocation('Ubuntu', '/ubuntu/path');
        await history.addLocation('Debian', '/debian/path');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/ubuntu/path']);
        expect(history.getHistory('Debian')).to.deep.equal(['/debian/path']);
    });

    it('should limit history to 10 entries', async () => {
        for (let i = 0; i < 12; i++) {
            await history.addLocation('Ubuntu', `/path/${i}`);
        }
        const result = history.getHistory('Ubuntu');
        expect(result).to.have.lengthOf(10);
        expect(result[0]).to.equal('/path/11');
        expect(result[9]).to.equal('/path/2');
    });

    it('should no-op when removing non-existent location', async () => {
        await history.removeLocation('Ubuntu', '/nonexistent');
        expect(history.getHistory('Ubuntu')).to.deep.equal([]);
    });
});
