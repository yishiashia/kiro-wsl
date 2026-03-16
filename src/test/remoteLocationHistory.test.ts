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

    it('should add location to empty history', () => {
        history.addLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/home/user/proj']);
    });

    it('should not add duplicate locations', () => {
        history.addLocation('Ubuntu', '/home/user/proj');
        history.addLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/home/user/proj']);
    });

    it('should move duplicate to front on re-add', () => {
        history.addLocation('Ubuntu', '/home/user/a');
        history.addLocation('Ubuntu', '/home/user/b');
        history.addLocation('Ubuntu', '/home/user/a');
        expect(history.getHistory('Ubuntu')).to.deep.equal([
            '/home/user/a',
            '/home/user/b',
        ]);
    });

    it('should remove location', () => {
        history.addLocation('Ubuntu', '/home/user/proj');
        history.removeLocation('Ubuntu', '/home/user/proj');
        expect(history.getHistory('Ubuntu')).to.deep.equal([]);
    });

    it('should maintain separate histories per distro', () => {
        history.addLocation('Ubuntu', '/ubuntu/path');
        history.addLocation('Debian', '/debian/path');
        expect(history.getHistory('Ubuntu')).to.deep.equal(['/ubuntu/path']);
        expect(history.getHistory('Debian')).to.deep.equal(['/debian/path']);
    });

    it('should limit history to 10 entries', () => {
        for (let i = 0; i < 12; i++) {
            history.addLocation('Ubuntu', `/path/${i}`);
        }
        const result = history.getHistory('Ubuntu');
        expect(result).to.have.lengthOf(10);
        expect(result[0]).to.equal('/path/11');
        expect(result[9]).to.equal('/path/2');
    });

    it('should no-op when removing non-existent location', () => {
        history.removeLocation('Ubuntu', '/nonexistent');
        expect(history.getHistory('Ubuntu')).to.deep.equal([]);
    });
});
