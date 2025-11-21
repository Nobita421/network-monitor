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
*   npm (v8 or higher)

### Installation

1.  Install dependencies:
    ```bash
    npm install
    ```

### Running the App

1.  Start the development server:
    ```bash
    npm run dev
    ```
    This will launch the Electron application with Hot Module Replacement (HMR) enabled.

## Building for Production

To create a Windows executable (.exe):

```bash
npm run build
```

The output will be in the `dist` or `release` folder.

## Tech Stack
*   **Electron**: Desktop runtime.
*   **React**: UI library.
*   **Vite**: Build tool.
*   **TypeScript**: Language.
*   **Tailwind CSS**: Styling.
*   **Recharts**: Data visualization.
*   **Systeminformation**: System stats retrieval.
