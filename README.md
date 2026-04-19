# NetMonitor Pro

A modern Windows desktop application to monitor network activity, built with Electron, React, and TypeScript.

## Features
*   **Real-time Monitoring**: View current Upload and Download speeds.
*   **Visual Dashboard**: Interactive charts showing network history.
*   **Active Connections**: List of all active network connections and their states.
*   **Alerts**: Notifications when network usage exceeds defined thresholds.

## Getting Started

### Prerequisites
*   Node.js (v16 or higher)
*   pnpm

### Installation

1.  Install dependencies:
    ```bash
    pnpm install
    ```

### Running the App

1.  Start the development server:
    ```bash
    pnpm dev
    ```
    This will launch the Electron application with Hot Module Replacement (HMR) enabled.

## Building for Production

To create a Windows executable (.exe):

```bash
pnpm build
```

The packaged Windows artifacts will be written to the `release/` folder.

## Tech Stack
*   **Electron**: Desktop runtime.
*   **React**: UI library.
*   **Vite**: Build tool.
*   **TypeScript**: Language.
*   **Tailwind CSS**: Styling.
*   **Recharts**: Data visualization.
*   **Systeminformation**: System stats retrieval.
