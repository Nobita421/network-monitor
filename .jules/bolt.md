# Bolt's Journal

This journal documents critical learnings about performance optimization in this codebase.

## 2025-12-11 - React Hook Dependency Optimization
**Learning:** In `useNetworkData.ts`, a `useEffect` was re-aggregating a large list of connections (O(N)) every second because it depended on `trafficStats` (which updates every second), even though the connection list only updates every 5 seconds.
**Action:** Split the aggregation into a `useMemo` that depends only on the slow-changing `connectionList`. Then use the aggregated result in the frequent `useEffect` for bandwidth calculation (O(M), where M << N). This pattern of separating "slow aggregation" from "fast updates" should be applied elsewhere.
