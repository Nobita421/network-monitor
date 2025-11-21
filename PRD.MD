# Product Requirements Document (PRD): NetMonitor Pro

## 1. Executive Summary
**NetMonitor Pro** is a desktop application for Windows designed to provide real-time visibility into network activity. Inspired by tools like Process Explorer and Resource Monitor, it offers a modern, user-friendly dashboard to monitor bandwidth usage, track active connections, and alert users when network consumption exceeds pre-defined thresholds.

## 2. Goals & Objectives
*   **Transparency**: Give users a clear view of what is consuming their internet bandwidth.
*   **Control**: Allow users to set limits and receive notifications to prevent overages or identify suspicious activity.
*   **Usability**: Provide a modern, graphical interface (Dashboard) that is easier to read than standard Windows tools.

## 3. Target Audience
*   **Power Users**: Who want to monitor background processes.
*   **Gamers**: Who need to ensure low latency and no background downloads.
*   **Limited Bandwidth Users**: Who need to stay within data caps.

## 4. Functional Requirements

### 4.1. Real-Time Monitoring
*   **Global Traffic**: Display current total Upload and Download speeds (e.g., Mbps, Kbps).
*   **Historical Graph**: A rolling line chart showing network usage over the last 60 seconds (similar to Task Manager).
*   **Active Connections**: List active network connections, including:
    *   Process Name
    *   Local Address/Port
    *   Remote Address/Port
    *   State (ESTABLISHED, LISTENING, etc.)

### 4.2. Alerting System
*   **Threshold Configuration**: Users can set a "Speed Limit" (e.g., "Alert if download > 10 MB/s") or "Data Cap" (e.g., "Alert if session usage > 1 GB").
*   **Notifications**: Native Windows Toast Notifications when thresholds are triggered.
*   **Cooldown**: Option to prevent notification spam (e.g., "Notify once every 5 minutes").

### 4.3. Dashboard Interface
*   **Overview Card**: Big metrics for current Up/Down speed.
*   **Traffic Chart**: Visual representation of bandwidth history.
*   **Top Processes**: (If technically feasible in MVP) A list of top 5 processes by current network usage.
*   **System Tray**: App should minimize to the system tray and show a quick tooltip or icon change based on activity.

### 4.4. Settings
*   Launch on Startup.
*   Theme selection (Light/Dark).
*   Unit selection (Bits vs Bytes).

## 5. Non-Functional Requirements
*   **Performance**: The app itself must be lightweight (< 1% CPU usage) to not interfere with the system it is monitoring.
*   **Reliability**: Must handle network disconnects/reconnects gracefully.
*   **Security**: Read-only access to network stats; no packet inspection or data collection sent to external servers.

## 6. User Interface (UI) Design
*   **Layout**: Sidebar navigation (Dashboard, Connections, Settings) + Main Content Area.
*   **Dashboard**: Grid layout with "Speedometer" gauges and "Time Series" charts.
*   **Color Palette**: Dark mode by default, using green for download and blue for upload (standard conventions).

## 7. Technical Architecture

### 7.1. Tech Stack
*   **Framework**: **Electron** (for cross-platform desktop capabilities).
*   **Frontend**: **React** (for UI components) + **Vite** (build tool).
*   **Language**: **TypeScript** (for type safety).
*   **State Management**: **Zustand** or **React Context**.
*   **Visualization**: **Recharts** or **Chart.js** for graphs.
*   **System Data**: 
    *   `systeminformation` (Node.js library) for general stats.
    *   Native Node modules (C++) or PowerShell execution for deeper process-level inspection if required.

### 7.2. Data Flow
1.  **Main Process (Electron)**: Runs a background interval (e.g., every 1s) to fetch system stats.
2.  **IPC Bridge**: Sends data from Main Process to Renderer Process via `contextBridge`.
3.  **Renderer Process (React)**: Updates the state and re-renders charts/tables. Checks for threshold violations and requests notifications.

## 8. Roadmap / Milestones

### Phase 1: MVP (Minimum Viable Product)
*   [ ] Project Setup (Electron + React + TypeScript).
*   [ ] Implement Global Network Speed monitoring.
*   [ ] Create Basic Dashboard with Real-time Graph.
*   [ ] Implement "High Usage" Notification.
*   [ ] Build executable for Windows.

### Phase 2: Enhanced Visibility
*   [ ] Add "Active Connections" table (Process mapping).
*   [ ] Add System Tray icon with context menu.
*   [ ] Persist settings (Thresholds) to disk.

### Phase 3: Advanced Features
*   [ ] Per-process bandwidth usage (requires advanced native integration).
*   [ ] Data usage logging (Daily/Weekly/Monthly reports).
*   [ ] Mini-overlay mode (Always on top widget).

## 9. Risks & Mitigation
*   **Risk**: High CPU usage from polling system stats too frequently.
    *   *Mitigation*: Allow user to configure update interval (1s, 2s, 5s).
*   **Risk**: Inaccurate per-process data on Windows.
    *   *Mitigation*: Clearly label data sources; fallback to "Active Connections" list if bandwidth per process is unavailable via standard APIs.
