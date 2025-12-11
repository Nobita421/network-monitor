# Executional Task List: Network Monitor Pro Optimization

This document outlines the steps required to elevate the Network Monitor application to a professional, robust, and secure Windows application.

## Phase 1: Security Hardening (Critical)
- [ ] **Implement Content Security Policy (CSP)**
    - Add a strict `<meta http-equiv="Content-Security-Policy" ...>` tag to `index.html`.
    - Restrict sources to `'self'` and specific allowed external resources (if any).
- [ ] **Sanitize Preload Script (`electron/preload.ts`)**
    - **Remove** generic `ipcRenderer.send`, `ipcRenderer.invoke`, and `ipcRenderer.on` exposure.
    - **Replace** with specific, typed functions for every required action (e.g., `onTrafficUpdate`, `onConnectionUpdate`).
    - Ensure no raw Electron objects leak to the renderer.
- [ ] **Verify External Links**
    - Ensure all `target="_blank"` links in the renderer use `rel="noopener noreferrer"`.
    - Intercept `will-navigate` and `new-window` events in the main process to prevent unauthorized external navigation.

## Phase 2: Performance Optimization
- [ ] **Virtualize Connection Table**
    - Replace the standard HTML `<table>` in `ConnectionTable.tsx` with a virtualization library like `react-virtuoso` or `react-window`.
    - This is essential for handling thousands of network connections without UI lag.
- [ ] **Optimize Main Process IPC**
    - **GeoIP Lookup**: Move `geoip.lookup` calls to a worker thread or ensure they are strictly non-blocking/batched. Implement an LRU cache for IP locations to avoid redundant lookups.
    - **Data Diffing**: Instead of sending the entire connection list every second, calculate the diff in the main process (or a worker) and only send changes to the renderer.
- [ ] **Reduce Polling Overhead**
    - Split polling intervals: Traffic stats (1s), Connection list (2-5s or user-configurable).

## Phase 3: Windows Native Integration
- [ ] **System Tray Implementation**
    - Add a System Tray icon using `Tray` from Electron.
    - Features: "Show/Hide", "Quit", and quick stats in the tooltip.
    - Minimize to Tray behavior: When the user clicks "X", hide the window instead of quitting.
- [ ] **Native Notifications**
    - Replace or augment in-app alerts with Windows Native Notifications for critical events (e.g., high traffic spike, new unknown process).
- [ ] **Single Instance Lock**
    - Ensure only one instance of the app runs using `app.requestSingleInstanceLock()`.

## Phase 4: Architecture & Reliability
- [ ] **Strict TypeScript Types**
    - Remove `any` usage in `electron/main.ts` (specifically around `global.geodatadir`).
    - Share types between Main and Renderer processes via a shared types file (already exists, but ensure full coverage).
- [ ] **Error Handling**
    - Add global error boundary in React.
    - Add `uncaughtException` and `unhandledRejection` handlers in the Main process to log errors to a file before graceful exit.
- [ ] **Auto-Updater**
    - Configure `electron-updater` to handle background updates.

## Phase 5: UI/UX Polish
- [ ] **Overlay Window Improvements**
    - Make the overlay window draggable and resizable (requires IPC to toggle `setIgnoreMouseEvents`).
- [ ] **Theme Consistency**
    - Ensure scrollbars match the dark theme.
