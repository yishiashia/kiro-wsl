import * as net from 'net';

export function findAvailablePort(startPort: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, '127.0.0.1', () => {
            const address = server.address();
            if (address && typeof address !== 'string') {
                const port = address.port;
                server.close(() => resolve(port));
            } else {
                server.close(() => reject(new Error('Failed to get port')));
            }
        });
        server.on('error', reject);
    });
}
