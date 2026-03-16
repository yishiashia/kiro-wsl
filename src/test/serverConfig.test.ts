import { expect } from 'chai';
import { resolveDownloadUrl, IServerConfig } from '../serverConfig';

describe('ServerConfig', () => {
    describe('resolveDownloadUrl', () => {
        const baseConfig: IServerConfig = {
            version: '1.0.0',
            commit: 'abc123',
            quality: 'stable',
            serverApplicationName: 'kiro-server',
            serverDataFolderName: '.kiro-server',
            serverDownloadUrlTemplate: 'https://example.com/${version}/${commit}/${quality}/${arch}/server.tar.gz',
        };

        it('should substitute all template variables', () => {
            const url = resolveDownloadUrl(baseConfig, 'x64');
            expect(url).to.equal('https://example.com/1.0.0/abc123/stable/x64/server.tar.gz');
        });

        it('should substitute arm64 architecture', () => {
            const url = resolveDownloadUrl(baseConfig, 'arm64');
            expect(url).to.equal('https://example.com/1.0.0/abc123/stable/arm64/server.tar.gz');
        });

        it('should handle template with no variables', () => {
            const config = { ...baseConfig, serverDownloadUrlTemplate: 'https://static.example.com/server.tar.gz' };
            const url = resolveDownloadUrl(config, 'x64');
            expect(url).to.equal('https://static.example.com/server.tar.gz');
        });

        it('should handle multiple occurrences of same variable', () => {
            const config = {
                ...baseConfig,
                serverDownloadUrlTemplate: 'https://example.com/${commit}/${commit}',
            };
            const url = resolveDownloadUrl(config, 'x64');
            expect(url).to.equal('https://example.com/abc123/abc123');
        });

        it('should substitute ${os} with linux', () => {
            const config = {
                ...baseConfig,
                serverDownloadUrlTemplate: 'https://example.com/kiro-reh-${os}-${arch}.tar.gz',
            };
            const url = resolveDownloadUrl(config, 'x64');
            expect(url).to.equal('https://example.com/kiro-reh-linux-x64.tar.gz');
        });

        it('should handle real Kiro product.json template', () => {
            const config = {
                ...baseConfig,
                commit: '7b506f30719296ba4f1aebfe383b426ffce0913e',
                serverDownloadUrlTemplate: 'https://prod.download.desktop.kiro.dev/releases/remotes/${commit}/kiro-reh-${os}-${arch}.tar.gz',
            };
            const url = resolveDownloadUrl(config, 'x64');
            expect(url).to.equal('https://prod.download.desktop.kiro.dev/releases/remotes/7b506f30719296ba4f1aebfe383b426ffce0913e/kiro-reh-linux-x64.tar.gz');
        });
    });
});
