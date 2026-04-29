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

## Validation Order
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build` (or `pnpm build:no-geoip`)

## Project Structure
- Electron main: `electron/main.ts`
- Preload: `electron/preload.ts`
- React entry: `src/main.tsx`
- IPC definitions: `src/lib/ipc.ts`
- Types: `src/types/index.ts`
- Path alias: `@/*` → `./src/*`

## TypeScript Config
- Strict mode with `noUnusedLocals`, `noUnusedParameters`
- `tsconfig.json` — source files (`include: ["src", "electron"]`)
- `tsconfig.node.json` — Vite config only

## Build Outputs
- Renderer bundle: `dist-renderer/`
- Electron output: `dist-electron/`
- Packaged app: `release/`
- GeoIP data embedded in build via `extraResources`

## Testing
- Vitest config: `vitest.config.ts`
- Test files: `src/**/*.test.ts`
- Run via `node ./scripts/run-vitest.mjs` (wrapper handles pnpm platform quirks)

## Dependencies
- **Package manager: pnpm only** (preinstall hook blocks other package managers)
- pnpm overrides in `package.json` pin transitive dependencies to fix vulnerabilities

## Framework Quirks
- Two BrowserWindows: main app + optional overlay window
- Traffic polling pauses when window is minimized/hidden (CPU optimization)
- `systeminformation` library collects network stats in main process, sent to renderer via IPC
- GeoIP lookups batched (max 500 IPs, 1500ms deadline) to avoid blocking IPC