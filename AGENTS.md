# NetMonitor Pro — Agent Guide

## Project Overview
Electron + React + TypeScript desktop app for Windows network monitoring.

## Key Commands
- `pnpm dev` — Start Electron app with HMR
- `pnpm build` — Production build (includes geoip update, may fail on network issues)
- `pnpm build:no-geoip` — Build without geoip update (use if geoip update fails)
- `pnpm test` — Run vitest via wrapper script
- `pnpm test:strict` — Run vitest with 30s timeouts (use if tests timeout)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint on `src` and `electron` directories
- `pnpm geoip:update` — Update GeoIP data (strict mode, may fail)
- `pnpm geoip:update:best-effort` — Update GeoIP data (best effort, won't fail build)

## Project Structure
- Electron main: `electron/main.ts` (windows, polling loops, IPC registration)
- Electron security: `electron/security.ts` (trusted senders, CSP, navigation guards)
- Electron GeoIP: `electron/geoip.ts` (ASN/geoip-lite loading, `lookupIpLocations`)
- Preload: `electron/preload.ts`
- React entry: `src/main.tsx`
- IPC definitions: `src/lib/ipc.ts`
- Types: `src/types/index.ts`
- Local DB: `src/lib/db.ts` (Dexie/IndexedDB)
- Path alias: `@/*` → `./src/*`

## TypeScript & Linting
- Strict mode with `noUnusedLocals`, `noUnusedParameters`
- `tsconfig.json` — source files (`include: ["src", "electron"]`)
- `tsconfig.node.json` — Vite config only
- **`@typescript-eslint/no-explicit-any: 'error'`** — the `any` type is forbidden

## Build Outputs
- Renderer bundle: `dist-renderer/`
- Electron output: `dist-electron/`
- Packaged app: `release/`
- GeoIP data embedded in build via `extraResources`
- Two Vite configs: `vite.config.ts` (dev + electron build), `vite.config.renderer.ts` (renderer-only, used in CI)

## CI Notes
- CI runs on `feat/ui-ux-redesign`, `master` (push), and `master` (PRs) only
- CI uses `--max-warnings 0` for ESLint; dev `pnpm lint` does not
- **CI lint is blocking** — failures fail the `typecheck-and-build` job
- Ubuntu job: typecheck + lint + tests + renderer-only build (`vite.config.renderer.ts`)
- Windows job (`package-windows`): full packaging via `pnpm build:no-geoip` (tsc + vite + electron-builder)

## Testing
- Vitest config: `vitest.config.ts`
- Test files: `src/**/*.test.ts` or `src/**/*.spec.ts`
- Run via `node ./scripts/run-vitest.mjs` (wrapper handles pnpm platform quirks)

## Dependencies
- **Package manager: pnpm only** (preinstall hook blocks other package managers)
- pnpm overrides in `package.json` pin transitive dependencies — do not remove them
- Overrides are mirrored in `pnpm-workspace.yaml` (`overrides` + `allowBuilds`) — required by pnpm ≥12, which ignores the `package.json` field; keep both in sync
- React 18, Tailwind CSS v3, Recharts, systeminformation, Dexie, geoip-lite

## Framework Quirks
- Two BrowserWindows: main app + optional overlay window
- Traffic polling pauses when window is minimized/hidden (CPU optimization)
- `systeminformation` collects network stats in main process, sent to renderer via IPC
- GeoIP lookups batched (max 500 IPs, 1500ms deadline) to avoid blocking IPC
- Single-instance lock via `app.requestSingleInstanceLock()` — close zombie processes if dev fails to connect

## IPC: Adding New Channels
- All IPC handlers must call `rejectUntrustedSender(event, channel)` for security
- New channels require coordinated changes in 3 files:
  1. `src/lib/ipc.ts` — add channel constant + update `DesktopApi` interface
  2. `electron/preload.ts` — expose via `contextBridge`
  3. `electron/main.ts` — register `ipcMain.handle` or `ipcMain.on`
- Renderer accesses the bridge via `window.desktop` (typed as `DesktopApi`); use `getDesktop()` / `isDesktopAvailable()` and `invokeWithTimeout()` from `src/lib/ipc.ts` — never call `window.desktop` directly (breaks outside Electron)