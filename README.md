# Kiro WSL

Open any folder in WSL2 and take advantage of Kiro's full feature set — file explorer, integrated terminal, and workspace extensions all running natively inside Linux.

> **Note:** This is a community extension, not officially maintained by the Kiro team.

## Features

- **Connect to WSL2** from Kiro running on Windows
- **Browse & edit files** in the WSL2 filesystem via Kiro's file explorer
- **Integrated terminal** running inside your WSL2 distribution
- **Workspace extensions** execute natively in the Linux environment
- **Remote Explorer** sidebar showing all WSL distributions and recent folders
- **Port forwarding** — WSL2 localhost is shared with Windows automatically
- **Auto-configuration** — proposed API settings are applied on first install; just restart Kiro

## Requirements

- **Windows 10/11** with WSL2 enabled
- **Kiro IDE** (v0.11+)
- At least one installed WSL2 distribution (e.g., Ubuntu)

Verify WSL2 is working:

```powershell
wsl --list --verbose
```

## Installation

### From `.vsix`

1. Download the latest `.vsix` from [Releases](https://github.com/yishiashia/kiro-wsl/releases)
2. In Kiro, press `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. Select the `.vsix` file
4. **Restart Kiro** — on first install, the extension auto-configures `argv.json` and prompts you to restart

### From Source

```bash
git clone https://github.com/yishiashia/kiro-wsl.git
cd kiro-wsl
npm install
npm run build
npm run package
```

Then install the generated `.vsix` in Kiro.

## Usage

### Connect to WSL

Press `Ctrl+Shift+P` and run any of these commands:

| Command | Description |
|---------|-------------|
| **Kiro WSL: Connect to WSL** | Connect to default distro (current window) |
| **Kiro WSL: Connect to WSL (New Window)** | Connect to default distro (new window) |
| **Kiro WSL: Connect to WSL using Distro...** | Pick a distro, then connect (current window) |
| **Kiro WSL: Connect to WSL using Distro in New Window...** | Pick a distro, then connect (new window) |
| **Kiro WSL: Show Log** | Show extension output log |

### Remote Explorer

The **WSL Targets** panel in the Remote Explorer sidebar lists all WSL distributions with their status (Running/Stopped) and recently opened folders. Right-click to connect or open in a new window.

### What Happens on Connect

1. The extension downloads the **Kiro REH (Remote Extension Host) server** into WSL
2. Starts the REH server on a random localhost port
3. Kiro connects via WebSocket — file explorer, terminal, and extensions now operate inside WSL2

The REH server persists across sessions and auto-shuts down after idle.

## Settings

| Setting | Type | Description |
|---------|------|-------------|
| `remote.WSL.serverDownloadUrlTemplate` | `string` | Custom REH server download URL template. Variables: `${version}`, `${commit}`, `${quality}`, `${arch}`, `${os}` |

Example for corporate mirrors:

```json
{
    "remote.WSL.serverDownloadUrlTemplate": "https://my-mirror.example.com/kiro-reh/${commit}/kiro-reh-${os}-${arch}.tar.gz"
}
```

## Troubleshooting

### Extension installs but nothing happens

- Ensure you are on **Windows** (the extension is a no-op on macOS/Linux)
- **Restart Kiro** after first install — the extension auto-patches `argv.json` but a restart is required
- If auto-config failed, manually add to `%USERPROFILE%\.kiro\argv.json`:
  ```json
  {
      "enable-proposed-api": ["yishiashia.kiro-wsl"]
  }
  ```

### Connection fails

- Verify WSL2 works: `wsl --list --verbose`
- Run `Kiro WSL: Show Log` from the command palette to see detailed logs
- Check the REH server log inside WSL: `~/.kiro-server/bin/<commit>/server.log`

### REH server download fails (403/404)

- The download URL comes from Kiro's `product.json` — it may change between Kiro versions
- Set a custom URL via the `remote.WSL.serverDownloadUrlTemplate` setting
- Ensure `curl` or `wget` is installed inside your WSL distribution

## Security Considerations

### REH Server Download

On first connection, the extension downloads the Kiro REH server binary from the official Kiro CDN over **HTTPS**. The download URL is derived from Kiro's `product.json` and cannot be overridden by workspace-level settings (the `remote.WSL.serverDownloadUrlTemplate` setting is scoped to `machine` only).

Currently, no SHA256 checksum verification is performed on the downloaded binary — this matches the behavior of Microsoft's official VS Code Remote extensions. Security relies on the integrity of the HTTPS connection to the CDN.

**For enterprise environments**, we recommend:

- Hosting the REH server binary on an internal mirror
- Setting `remote.WSL.serverDownloadUrlTemplate` in Kiro's **machine-level** settings to point to your mirror
- Verifying binary integrity through your internal distribution pipeline

### Connection Token

Each REH server instance uses a cryptographically random connection token (generated from `/dev/urandom`). The token is stored as a file inside WSL (not passed via CLI arguments), preventing exposure in process listings.

## How It Works

```
Kiro (Windows)                          WSL2 (Linux)
┌─────────────────────┐                ┌──────────────────────────┐
│  Extension (UI)     │                │  Kiro REH Server         │
│  ┌───────────────┐  │   wsl.exe     │  ┌──────────────────┐   │
│  │ Auth Resolver  │──┼──────────────►│  │ Extension Host   │   │
│  │ (wsl scheme)  │  │               │  │ File System      │   │
│  └───────────────┘  │   WebSocket   │  │ Terminal         │   │
│  ┌───────────────┐  │◄─────────────►│  │ Port: random     │   │
│  │ Remote Explorer│  │  127.0.0.1   │  └──────────────────┘   │
│  └───────────────┘  │               │                          │
└─────────────────────┘                └──────────────────────────┘
```

## Development

```bash
npm install          # Install dependencies
npm run compile      # Build (development)
npm run watch        # Build + watch for changes
npm run build        # Build (production)
npm test             # Run unit tests (42 tests)
npm run package      # Package as .vsix
```

## License

MIT
