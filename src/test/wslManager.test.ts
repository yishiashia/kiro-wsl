import { expect } from 'chai';
import { WSLManager, WSLDistro } from '../wsl/wslManager';

describe('WSLManager', () => {
    describe('parseDistroList', () => {
        it('should parse distros with default marker', () => {
            const output = [
                '  NAME      STATE     VERSION',
                '* Ubuntu    Running   2',
                '  Debian    Stopped   2',
            ].join('\n');

            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(2);
            expect(distros[0]).to.deep.equal({
                name: 'Ubuntu',
                state: 'Running',
                version: 2,
                isDefault: true,
            });
            expect(distros[1]).to.deep.equal({
                name: 'Debian',
                state: 'Stopped',
                version: 2,
                isDefault: false,
            });
        });

        it('should parse empty distro list', () => {
            const distros = WSLManager.parseDistroList('');
            expect(distros).to.have.lengthOf(0);
        });

        it('should parse header-only output', () => {
            const output = '  NAME      STATE     VERSION';
            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(0);
        });

        it('should parse distro with hyphenated name', () => {
            const output = [
                '  NAME            STATE     VERSION',
                '  Ubuntu-22.04    Running   2',
            ].join('\n');

            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(1);
            expect(distros[0]).to.deep.equal({
                name: 'Ubuntu-22.04',
                state: 'Running',
                version: 2,
                isDefault: false,
            });
        });

        it('should handle WSL1 distros', () => {
            const output = [
                '  NAME      STATE     VERSION',
                '* Legacy    Running   1',
            ].join('\n');

            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(1);
            expect(distros[0]).to.deep.equal({
                name: 'Legacy',
                state: 'Running',
                version: 1,
                isDefault: true,
            });
        });
        it('should parse distro names with spaces', () => {
            const output = [
                '  NAME                STATE     VERSION',
                '* My Distro Name     Running   2',
                '  Another One        Stopped   1',
            ].join('\n');

            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(2);
            expect(distros[0]).to.deep.equal({
                name: 'My Distro Name',
                state: 'Running',
                version: 2,
                isDefault: true,
            });
            expect(distros[1]).to.deep.equal({
                name: 'Another One',
                state: 'Stopped',
                version: 1,
                isDefault: false,
            });
        });

        it('should parse Installing state', () => {
            const output = [
                '  NAME      STATE        VERSION',
                '  NewDist   Installing   2',
            ].join('\n');

            const distros = WSLManager.parseDistroList(output);
            expect(distros).to.have.lengthOf(1);
            expect(distros[0]).to.deep.equal({
                name: 'NewDist',
                state: 'Installing',
                version: 2,
                isDefault: false,
            });
        });
    });

    describe('parseDistroLine', () => {
        it('should parse a default running distro', () => {
            const result = WSLManager.parseDistroLine('* Ubuntu Running 2');
            expect(result).to.deep.equal({
                name: 'Ubuntu',
                state: 'Running',
                version: 2,
                isDefault: true,
            });
        });

        it('should parse a non-default stopped distro', () => {
            const result = WSLManager.parseDistroLine('  Debian Stopped 2');
            expect(result).to.deep.equal({
                name: 'Debian',
                state: 'Stopped',
                version: 2,
                isDefault: false,
            });
        });

        it('should return null for empty line', () => {
            expect(WSLManager.parseDistroLine('')).to.be.null;
        });

        it('should return null for malformed line', () => {
            expect(WSLManager.parseDistroLine('incomplete')).to.be.null;
        });

        it('should return null for invalid state', () => {
            expect(WSLManager.parseDistroLine('Ubuntu BadState 2')).to.be.null;
        });

        it('should return null for invalid version', () => {
            expect(WSLManager.parseDistroLine('Ubuntu Running 3')).to.be.null;
        });

        it('should parse distro name with spaces', () => {
            const result = WSLManager.parseDistroLine('My Custom Distro Running 2');
            expect(result).to.deep.equal({
                name: 'My Custom Distro',
                state: 'Running',
                version: 2,
                isDefault: false,
            });
        });

        it('should parse Installing state', () => {
            const result = WSLManager.parseDistroLine('NewDist Installing 2');
            expect(result).to.deep.equal({
                name: 'NewDist',
                state: 'Installing',
                version: 2,
                isDefault: false,
            });
        });
    });
});
