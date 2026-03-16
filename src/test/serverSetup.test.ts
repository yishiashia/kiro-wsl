import { expect } from 'chai';
import { parseServerOutput, ServerInstallError } from '../serverSetup';

describe('ServerSetup', () => {
    describe('parseServerOutput', () => {
        it('should parse successful output', () => {
            const output = '0::43721::tokenABC::12345::/path/log';
            const result = parseServerOutput(output);
            expect(result).to.deep.equal({
                host: '127.0.0.1',
                port: 43721,
                connectionToken: 'tokenABC',
            });
        });

        it('should parse output with server already running', () => {
            const output = '0::43721::tokenABC::12345::/path/log';
            const result = parseServerOutput(output);
            expect(result.port).to.equal(43721);
            expect(result.connectionToken).to.equal('tokenABC');
        });

        it('should parse multi-line output (last line is result)', () => {
            const output = 'Downloading Kiro REH server...\nExtracting...\n0::8080::mytoken::999::/tmp/log';
            const result = parseServerOutput(output);
            expect(result.port).to.equal(8080);
            expect(result.connectionToken).to.equal('mytoken');
        });

        it('should throw on download failure', () => {
            const output = '1:::::::::';
            expect(() => parseServerOutput(output)).to.throw(ServerInstallError, 'exited with code 1');
        });

        it('should throw on invalid port', () => {
            const output = '0::notanumber::token::pid::log';
            expect(() => parseServerOutput(output)).to.throw(ServerInstallError, 'Invalid port');
        });

        it('should throw on missing connection token', () => {
            const output = '0::8080::::pid::log';
            expect(() => parseServerOutput(output)).to.throw(ServerInstallError, 'Missing connection token');
        });

        it('should throw on malformed output', () => {
            const output = 'unexpected output';
            expect(() => parseServerOutput(output)).to.throw(ServerInstallError, 'Unexpected server output');
        });

        it('should throw on negative port', () => {
            const output = '0::-1::token::pid::log';
            expect(() => parseServerOutput(output)).to.throw(ServerInstallError, 'Invalid port');
        });
    });
});
