// Central allowlist of browser storage keys the app is permitted to persist
// (#26). The read-only invariant means this list is EMPTY: the browser writes
// nothing durable — no localStorage, sessionStorage, indexedDB, beacons, or
// non-GET fetches.
//
// Any future demo-mode exception (e.g. a documented localStorage key or a
// layout-export path) must be added here WITH a comment explaining it, and
// cross-referenced in SECURITY.md. The runtime QA test fails on any write whose
// key is not in this list — so adding an unauthorized write breaks CI.
export const ALLOWED_STORAGE_KEYS = [];
