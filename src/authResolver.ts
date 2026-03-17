import * as vscode from 'vscode';
import { WSLManager } from './wsl/wslManager';
import { getServerConfig } from './serverConfig';
import { installAndStartServer, ServerInstallError } from './serverSetup';
import { Logger } from './common/logger';

// Proposed API types — not in stable @types/vscode
interface RemoteAuthorityResolverContext {
    resolveAttempt: number;
}

interface ResolvedAuthority {
    host: string;
    port: number;
    connectionToken?: string;
}

interface TunnelOptions {
    remoteAddress: { host: string; port: number };
    localAddressPort?: number;
    label?: string;
}

interface Tunnel {
    remoteAddress: { host: string; port: number };
    localAddress?: { host: string; port: number } | string;
    dispose(): void;
}

export class RemoteWSLResolver {
    private readonly wslManager: WSLManager;
    private readonly logger: Logger;

    constructor(wslManager: WSLManager, logger: Logger) {
        this.wslManager = wslManager;
        this.logger = logger;
    }

    async resolve(
        authority: string,
        _context: RemoteAuthorityResolverContext
    ): Promise<ResolvedAuthority> {
        const distro = RemoteWSLResolver.parseAuthority(authority);
        this.logger.info(`Resolving remote authority for distro: ${distro}`);

        try {
            const config = getServerConfig();
            const connection = await installAndStartServer(
                this.wslManager,
                distro,
                config,
                this.logger
            );

            return {
                host: connection.host,
                port: connection.port,
                connectionToken: connection.connectionToken,
            };
        } catch (error) {
            if (error instanceof ServerInstallError) {
                this.logger.error('Server installation failed', error);
                const resolverError = new Error(
                    `Failed to install Kiro server in WSL (${distro}): ${error.message}`
                );
                (resolverError as any).code = 'NotAvailable';
                (resolverError as any).isHandled = true;
                throw resolverError;
            }

            this.logger.error('Unexpected error during resolution', error);
            const resolverError = new Error(
                `Failed to connect to WSL (${distro}): ${error instanceof Error ? error.message : String(error)}`
            );
            (resolverError as any).code = 'TemporarilyNotAvailable';
            throw resolverError;
        }
    }

    tunnelFactory(tunnelOptions: TunnelOptions): Promise<Tunnel> | undefined {
        // WSL2 shares localhost with Windows host — pass-through tunnel
        const { remoteAddress } = tunnelOptions;
        this.logger.info(`Creating tunnel for ${remoteAddress.host}:${remoteAddress.port}`);

        const tunnel: Tunnel = {
            remoteAddress,
            localAddress: { host: '127.0.0.1', port: remoteAddress.port },
            dispose: () => { /* no-op: WSL2 localhost is shared */ },
        };

        return Promise.resolve(tunnel);
    }

    static parseAuthority(authority: string): string {
        // authority format: "wsl+<distro>" — strip the "wsl+" prefix
        const prefix = 'wsl+';
        if (!authority.startsWith(prefix)) {
            throw new Error(`Invalid WSL authority: ${authority}`);
        }
        const distro = decodeURIComponent(authority.substring(prefix.length));
        if (!distro) {
            throw new Error('WSL authority is missing the distribution name (got "wsl+")');
        }
        return distro;
    }
}
