# NetMonitor Pro – CPU/GPU Mitigation Plan

## Purpose
Document a phased, out-of-the-box strategy to curb CPU and GPU consumption without sacrificing the immersive dashboard experience. Each section below ties a specific hotspot in the current Electron + React stack to concrete remediation steps.

## Hotspot Snapshot
| Hotspot | Current Impact | Primary Goal |
| --- | --- | --- |
| Telemetry polling in `electron/main.ts` | 1 Hz `systeminformation` calls pin the Electron main thread, with `networkConnections()` causing multi-second CPU spikes. | Move to event-driven, adaptive sampling that never blocks the UI thread. |
| Renderer updates in `src/App.tsx` | Every tick clones 300-point history arrays, recomputes aggregates, re-renders Recharts, and filters the full connection table. | Stream diffs into fixed buffers and offload heavy charting/table work away from the React tree. |
| Visual effects stack | Multiple backdrop blurs, layered radial gradients, and large drop shadows spend GPU cycles even when data is idle. | Dynamically budget eye candy based on live GPU headroom so telemetry always wins. |

## Mitigation Steps

### 1. Adaptive Telemetry Plane
1. **Spawn a dedicated Node worker** from the main process that owns all system probes.
2. Inside the worker, subscribe to Windows ETW NetEvent providers (or `Netsh trace`) for incremental RX/TX deltas; fall back to `systeminformation.networkStats()` only on startup.
3. Maintain a shared-memory ring buffer (`SharedArrayBuffer`) that stores `(timestamp, rx, tx, variance)` tuples; expose it via `MessageChannel` to the renderer.
4. Implement a predictive sampler: compute the rolling variance of RX/TX inside the worker and expand the polling window to 5–10 s when variance is flat, snapping back to 1 s when spikes start.
5. Gate `networkConnections()` behind a diff tracker: seed once via Win32 `GetExtendedTcpTable`, then process ETW `MSNT_Tcpip` events to push only connection additions/removals across IPC.
6. Surface telemetry health metrics (lag, worker CPU) so the renderer can detect stalled probes and temporarily fall back to coarse sampling.

### 2. Renderer & Chart Pipeline Offload
1. Convert the history graph into an `OffscreenCanvas` driven by a dedicated Web Worker; draw the 60–300-point spark lines using Canvas2D or WebGPU and transfer only the bitmap to React.
2. Replace per-tick array cloning with a fixed-length `Float32Array` for RX/TX plus a timestamp buffer; wrap it with `useSyncExternalStore` so React reads snapshots without triggering GC churn.
3. Memoize `averages` and statistics inside the telemetry worker; pass down ready-to-render aggregates instead of recomputing inside `App.tsx`.
4. For the connections table, maintain a WASM trie or Bloom-filter index of process names and addresses; React requests paged IDs and renders only the visible window via `react-virtualized`.
5. Split `dashboard` and `connections` into separate React roots. Use `scheduler.postTask` with priorities so the heavy table never blocks the lightweight metric tiles.

### 3. Visual Effect Budgeting
1. Create a `useRenderBudget()` hook that samples `performance.measureUserAgentSpecificMemory()` and `requestAnimationFrame` deltas to estimate GPU headroom every 2 s.
2. When headroom drops below the target (e.g., 12 ms frame time), programmatically swap backdrop-blur panels for static SVG gradients and disable animated shadows.
3. Expose a "Cinematic Mode" toggle in settings: when off, the dashboard defaults to the low-cost theme and only re-enables effects in short bursts (e.g., when user hovers a card).
4. Pre-render gradient backgrounds as PNG/AVIF textures and reuse them as CSS `background-image` assets instead of recomputing radial gradients in CSS every frame.

### 4. Instrumentation & Guard Rails
1. Embed a hidden diagnostics overlay (toggled via `Ctrl+Shift+D`) that charts `app.getAppMetrics()` CPU %, GPU frame cost, and IPC latency so regressions are visible instantly.
2. Add a Playwright-perf test that opens both tabs, runs scripted interactions for 30 s, and captures a Chrome trace. Fail CI if average CPU > 25% or frame time > 16 ms.
3. Ship telemetry toggles (`pause worker`, `reduce frequency`, `dump ETW stream`) so support can reproduce performance issues without custom builds.

## Execution Order
1. **Week 1** – Stand up telemetry worker + shared buffers; verify event-driven stats parity with existing polling.
2. **Week 2** – Migrate renderer history chart to OffscreenCanvas and integrate fixed-length buffers.
3. **Week 3** – Implement connection diffing & virtualized table; validate with synthetic 5k-connection datasets.
4. **Week 4** – Roll out render-budget hook, asset swaps, and the diagnostics overlay; wire Playwright perf gate into CI.

## Success Criteria
- Idle dashboard stays under 5% total CPU and <150 MB resident set on mid-range hardware.
- Frame time remains under 12 ms during dashboard activity and under 16 ms while scrolling the connections table.
- Telemetry worker recovers from spikes within two sampling windows and never blocks the main Electron thread.
