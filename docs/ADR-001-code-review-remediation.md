# ADR-001: Code Review Remediation — Data Safety, Algorithm Correctness & Observability

**Status:** Accepted
**Date:** 2026-08-01
**Authors:** Code Review (AI-assisted), Project Maintainer
**Commits:** `e896f66` (Round 1 fixes), `5d9ef3f` (Round 2 fixes)

---

## Context

The Generic Health Connect Workout Merger reached feature-complete state at v1.0.0. A comprehensive two-round code review was conducted across all tracked source files to evaluate data safety, algorithmic correctness, type safety, i18n completeness, CI/CD hygiene, and test coverage.

Round 1 ([CODE_REVIEW.md](../CODE_REVIEW.md)) identified **30 issues** spanning critical data-loss paths, logic bugs, and maintenance risks. Round 2 ([CODE_REVIEW_ROUND_2.md](../CODE_REVIEW_ROUND_2.md)) verified the 30 fixes and identified **7 remaining issues** introduced or left incomplete by the first round of fixes.

This ADR documents the architectural decisions made while resolving all 37 issues, explains the trade-offs considered, and records the rationale for the chosen approaches.

---

## Decision Summary

### 1. Atomic Merge with Best-Effort Rollback

**Problem:** The `executeMerge` operation performed insert-session → insert-sub-records → delete-originals sequentially with no transactional guarantee. A failure midway left orphaned duplicates.

**Decision:** Implement a **best-effort rollback strategy** rather than a true two-phase commit.

**Rationale:**
- Health Connect's SDK provides no native transaction support — each `insertRecords` / `deleteRecordsByUuids` call is independent.
- A true two-phase commit would require staging inserts in a local database first, which adds significant complexity for a client-side app.
- Best-effort rollback tracks all successfully inserted record UUIDs (returned by `insertRecords`) in an `insertedRecordsToRollback` array. On failure, it iterates in **reverse order** (child sub-records before parent session) to clean up.
- Individual rollback failures are caught and logged but do not propagate — partial cleanup is preferable to crashing.

**Implementation:** [`HealthConnectService.executeMerge()`](../services/HealthConnectService.ts)

```
Insert Session  →  track UUID  →  [SUCCESS]
Insert HR       →  track UUID  →  [SUCCESS]
Insert Distance →  track UUID  →  [FAILS]  ← throws
                                              ↓
                              ROLLBACK: delete Distance UUIDs (none — insert failed)
                              ROLLBACK: delete HR UUIDs
                              ROLLBACK: delete Session UUID
                              RE-THROW original error
```

**Trade-off:** If the rollback itself fails (e.g., Health Connect crashes), some records may remain. This is accepted as the lesser evil versus the previous behavior of guaranteed data duplication on failure.

---

### 2. Sub-Record Cascade Deletion

**Problem:** Only `ExerciseSession` records were deleted during merge. The original sub-records (heart rate, distance, calories, etc.) were orphaned in Health Connect, causing double-counting by other apps.

**Decision:** Collect all sub-record `metadata.id` UUIDs from the original sessions **at payload generation time** and include them in `MergedWorkoutPayload.originalSubRecordIdsToDelete`. The merge executor deletes sub-records **before** deleting sessions.

**Rationale:**
- Health Connect does not cascade-delete sub-records when a parent session is removed.
- Collecting UUIDs at payload generation time (in the pure algorithm layer) keeps the service layer thin — it just executes the deletions.
- Deleting sub-records before sessions prevents a window where orphaned sub-records exist without their parent.

**Implementation:** A `subRecordMap` array in [`generateMergedWorkoutPayload()`](../utils/MergeAlgorithm.ts) maps all 15 `WorkoutSubRecords` keys to their `RecordType` discriminator. UUIDs are collected into `Set<string>` per type to avoid duplicates.

---

### 3. Majority-Vote Activity Category Detection

**Problem:** Category detection used a fixed priority (indoor > outdoor > stationary). A single misclassified indoor session would override 5 legitimate outdoor sessions.

**Decision:** Replace fixed priority with a **majority-vote** system. On ties, preserve the original priority order (indoor > outdoor > stationary) as a tie-breaker.

**Rationale:**
- The majority rule is more accurate for real-world data where one session may be misclassified by a heuristic.
- The tie-breaker preserves backward compatibility and favors indoor classification in ambiguous cases (indoor equipment telemetry is more sensitive to misclassification — choosing the wrong distance source for a treadmill session is more impactful than for an outdoor run).
- The implementation leverages JavaScript's guaranteed stable `Array.prototype.sort` (ES2019+, stable in V8 and Hermes) — candidates are pushed in priority order, and a descending count sort preserves insertion order for equal counts.

**Alternatives considered:**
- Weighted scoring (e.g., sessions with more sub-records get higher weight) — rejected as over-engineered for the current data model.
- Unanimous agreement required — rejected as too strict; one misclassified session would deadlock the algorithm.

---

### 4. Guarded `isMachineSession` Heuristic

**Problem:** The fallback `(hasDistance && noHeartRate)` classified any session with distance but no HR as a "machine session," misidentifying phone-only outdoor runs.

**Decision:** Gate the distance-without-HR fallback on the **group's detected category**. The fallback only fires when `groupCategory === ActivityCategory.INDOOR_MACHINE`.

**Rationale:**
- A phone-only outdoor run (no HR sensor) has distance + no HR, indistinguishable from a treadmill app by data alone.
- Using the group category as context resolves the ambiguity: if the group is already classified as outdoor (via majority vote), the distance-without-HR heuristic is suppressed.
- The `groupCategory` parameter is optional to maintain backward compatibility for external callers.

**Alternative considered:** Requiring both an indoor exercise type AND distance-without-HR — rejected because exercise types are not always reliably set by all apps.

---

### 5. Hybrid Deduplication Key (metadata.id + origin:timestamp)

**Problem:** Deduplication used only timestamp strings as the key, silently dropping legitimate records from different sources that shared the same time window.

**Decision:** Use `metadata.id` as the primary dedup key when available, falling back to `{dataOrigin}_{startTime}_{endTime}` (or `{dataOrigin}_{time}` for instantaneous records).

**Rationale:**
- `metadata.id` is globally unique for records read from Health Connect and is the most precise dedup key.
- The origin-qualified timestamp fallback handles records constructed locally (which may lack `metadata.id`) while still preserving records from different sources with the same timestamp.
- Reading `metadata` before stripping it (the destructure happens after the dedup check) is safe and intentional.

---

### 6. Canonical Metric Extractors (DRY)

**Problem:** `extractDistanceMeters`, `extractCaloriesKcal`, and `extractAvgHeartRateBpm` were duplicated between `MergeAlgorithm.ts` and `FormatUtils.ts` (~60 lines each).

**Decision:** Create a canonical [`utils/MetricExtractors.ts`](../utils/MetricExtractors.ts) module. Re-export from `MergeAlgorithm.ts` to maintain backward compatibility.

**Rationale:**
- Single source of truth for unit conversion logic (meters, kilometers, miles; kilocalories, calories).
- Re-exporting preserves the public API for any consumer importing from `MergeAlgorithm`.
- `FormatUtils.ts` now delegates to `MetricExtractors` for the numeric computation and only handles string formatting (`"2.35 km"`, `"140 kcal"`).

---

### 7. Deterministic Group IDs via Sorted Session Metadata

**Problem:** Group IDs used `group_{earliestTimeMs}_{latestTimeMs}_{sessionCount}`, which could collide when two groups shared the same time bounds and count.

**Decision:** Replace session count with a sorted, joined string of constituent session `metadata.id` values.

**Rationale:**
- Health Connect guarantees unique `metadata.id` for records it returns, making the composite ID unique.
- Sorting ensures determinism regardless of session input order (same sessions → same ID across renders).
- The `idx${i}` fallback for sessions without `metadata.id` is position-dependent but acceptable since this case is extremely rare with real Health Connect data.

---

### 8. Per-Origin Sub-Record Scoping (dataOriginFilter)

**Problem (Round 1):** The original `dataOriginFilter` excluded legitimate cross-origin sub-records (e.g., chest strap HR written to another app's session). **Problem (Round 2):** Removing the filter entirely caused cross-contamination — each session included sub-records from *all* apps in its time window, inflating metrics.

**Decision:** **Re-introduce** the server-side `dataOriginFilter` but **remove** the redundant client-side `filterByOrigin`.

**Rationale:**
- The merge algorithm assumes each session's `subRecords` belong to the session's originating app. This assumption is critical for `isWearableSession`, `isMachineSession`, noise threshold calculations, and distance/calorie extraction.
- The server-side filter (`readRecords` option) is the correct layer for scoping — it prevents unnecessary data transfer and processing.
- The client-side `filterByOrigin` was redundant (double-filtering the same origin) and had an inconsistent fallback (records without `dataOrigin` passed through).
- Cross-origin sub-records (e.g., chest strap HR) are a rare edge case that can be addressed in a future version with explicit cross-origin association logic.

---

### 9. State Management: Object-Reference Filtering After Merge

**Problem:** `handleMergeSuccess` used index-based fallback IDs (`sess_${idx}`) to remove merged sessions from `rawSessions`. The indices were scoped to different arrays (conflict group vs. full session list), causing mismatches.

**Decision:** Use **object reference comparison** (`Set<DetailedWorkoutSession>`) as the primary filter, with a secondary `Set<string>` of actual `metadata.id` values.

**Rationale:**
- Object references are stable — the same `DetailedWorkoutSession` object exists in both `conflictGroups` and `rawSessions` (no cloning occurs).
- The secondary `metadata.id` set provides a defense-in-depth match for cases where React's concurrent mode might re-create objects.
- No index-based fallbacks are used, eliminating the cross-array mismatch entirely.

---

### 10. `useRef` Pattern for Stable Callbacks

**Problem:** `loadWorkoutSessions` included `toleranceMinutes` in its `useCallback` dependency array, creating a circular chain: tolerance change → callback recreated → `useEffect` re-triggers → unnecessary re-initialization.

**Decision:** Store `toleranceMinutes` in a `useRef` and read from `.current` inside the callback. Remove `toleranceMinutes` from the dependency array.

**Rationale:**
- This is the standard React pattern for accessing the latest state value without triggering dependency changes.
- The ref is updated synchronously on every render (`toleranceMinutesRef.current = toleranceMinutes`), so the callback always reads the current value.
- Breaks the circular dependency chain while maintaining correctness.

---

### 11. Principle of Least Privilege for Health Connect Permissions

**Problem:** The app requested read/write permissions for 35+ Health Connect record types, including sensitive medical data (blood glucose, blood pressure, menstruation, sexual activity, etc.) that the app never reads or writes.

**Decision:** Restrict `REQUIRED_HEALTH_PERMISSIONS` and `app.json` to the **16 fitness-related record types** the app actually uses.

**Implementation:** A `USED_HEALTH_RECORD_TYPES` array in [`types.ts`](../types.ts) is the single source of truth. Permissions are generated programmatically via `flatMap` to ensure read+write pairs stay in sync.

**Record types retained:** `ActiveCaloriesBurned`, `CyclingPedalingCadence`, `Distance`, `ElevationGained`, `ExerciseSession`, `FloorsClimbed`, `HeartRate`, `HeartRateVariabilityRmssd`, `Power`, `RestingHeartRate`, `Speed`, `Steps`, `StepsCadence`, `TotalCaloriesBurned`, `Vo2Max`, `WheelchairPushes`.

---

### 12. Dark Mode Support via MD3 Theme Tokens

**Problem:** Dozens of hardcoded hex colors (`#F8FAFC`, `#E2E8F0`, `#0369A1`, etc.) were used throughout the UI. The app had `userInterfaceStyle: "automatic"` in `app.json` but was hardcoded to `MD3LightTheme`.

**Decision:** Replace **all** hardcoded colors with Material Design 3 theme tokens and add runtime dark mode toggling.

**Implementation:**
- `AppWrapper` manages an `isDarkMode` state passed to `PaperProvider` as `MD3DarkTheme` or `MD3LightTheme`.
- A theme toggle (segmented button) is exposed in the Settings dialog.
- All `StyleSheet.create` entries that previously had hardcoded colors now have those colors removed; dynamic colors are applied via inline `style={[styles.foo, { backgroundColor: theme.colors.X }]}` arrays (theme values are not available at `StyleSheet.create` time).
- `CategoryBadgeUtils.ts` accepts an optional `MD3Theme` parameter and maps categories to semantic container/onContainer token pairs (e.g., `secondaryContainer` / `onSecondaryContainer`). Hex fallbacks exist only for backward compatibility when `theme` is undefined.
- `StatusBar` `barStyle` adapts to the active theme.

---

### 13. Warning Logger Service & Observability UI

**Problem:** `Promise.allSettled` in `fetchSubRecordsForTimeRange` silently returned empty arrays for failed sub-record reads. SDK errors in `checkPermissions`, `requestPermissions`, and `initializeSDK` were logged to console but invisible to the user.

**Decision:** Introduce a **`WarningLogger` singleton service** with an in-app log viewer, replacing silent `console.error` / `console.warn` calls with structured, observable logging.

**Architecture:**
```
WarningLogger (singleton)
├── In-memory ring buffer (100 entries, newest-first)
├── Pub/sub listener system (subscribe/unsubscribe returns cleanup fn)
├── Structured LogEntry { id, timestamp, level, message, details }
├── .warn(message, details)  → console.warn + buffer
├── .error(message, details) → console.error + buffer
├── .getLogsAsFormattedText() → for email/share export
└── .clearLogs()
```

**UI:** A [`LogExportModal`](../components/LogExportModal.tsx) dialog surfaces logs with level-colored chips, timestamps, and stack traces. Actions include email (via `Linking.openURL(mailto:)`), share (via `Share.share()`), and clear. An app bar badge (alert icon with error color) appears when `warningCount > 0`.

**Rationale:**
- Users of a Health Connect merge tool cannot diagnose failures without visibility into SDK errors.
- A ring buffer with 100-entry cap prevents unbounded memory growth.
- The pub/sub pattern allows the React component to reactively update without polling.
- Email/share export gives users a way to report issues to the developer with structured context.

---

### 14. Complete i18n Coverage

**Problem:** Multiple UI strings were hardcoded in English: modal metadata labels, metric chip prefixes, fallback text (`'Unknown'`, `'N/A'`, `'Exercise Session'`), and the empty-state subtitle hardcoded `{days: '7'}`.

**Decision:** Translate **all** user-visible strings via the `t()` function. Both `en.ts` and `pl.ts` are type-checked at compile time via `TranslationKeys = typeof en`.

**New translation keys added across both rounds:**

| Key | Purpose |
|-----|---------|
| `confirmationModal.timeWindowLabel` | Session time range label |
| `confirmationModal.packageOriginLabel` | Data origin label |
| `confirmationModal.sessionUuidLabel` | Session UUID label |
| `confirmationModal.clientRecordIdLabel` | Client record ID label |
| `confirmationModal.lastModifiedLabel` | Last modified timestamp label |
| `confirmationModal.notesLabel` | Notes label |
| `confirmationModal.defaultSessionTitle` | Fallback session title |
| `confirmationModal.unknownOrigin` | Unknown origin fallback |
| `confirmationModal.notAvailable` | N/A fallback |
| `metrics.hrChip` / `distChip` / `calChip` | Metric chip labels |
| `settings.themeHeader` / `themeLight` / `themeDark` | Theme toggle labels |
| `settings.viewLogsButton` | Log viewer button |
| `logsModal.*` | 7 keys for the log export modal |

---

### 15. CI/CD Cleanup

**Changes made:**
- `pnpm tsc` → `pnpm run typecheck` (uses the project's `--noEmit` script).
- Removed reference to non-existent `app-dev.apk` from release artifacts.
- Removed dead `metro.config.js` SVG transformer step (project doesn't use SVGs).
- Removed `package.json` `main` entry override (project's `index.js` with `registerRootComponent` is correct).

---

## Consequences

### Positive
- **Data safety:** Merge operations now have rollback protection and cascade sub-record deletion.
- **Algorithmic accuracy:** Majority-vote category detection and guarded machine heuristic reduce misclassification.
- **Observability:** SDK failures are no longer silent; users can view, export, and report warnings.
- **Dark mode:** Full MD3 theme token compliance enables light/dark switching.
- **Maintainability:** Canonical metric extractors, typed function signatures (no more `any`), and 31 unit tests.
- **Privacy:** Permission scope reduced from 35+ record types to 16 fitness-only types.

### Negative / Accepted Trade-offs
- **Rollback is best-effort:** If Health Connect crashes during rollback, some records may remain orphaned. Accepted as unavoidable without SDK transaction support.
- **Per-origin filtering excludes cross-origin sub-records:** A chest strap HR app writing data under a different package name than the session's origin will have its data excluded. This is a known limitation accepted for algorithmic correctness; cross-origin association can be addressed in a future version.
- **Group ID `idx` fallback is position-dependent:** Sessions without `metadata.id` use array-index-based IDs, which are non-deterministic if input order changes. Accepted as extremely rare with real Health Connect data.

---

## References

- [CODE_REVIEW.md](../CODE_REVIEW.md) — Round 1: 30 issues identified and fixed
- [CODE_REVIEW_ROUND_2.md](../CODE_REVIEW_ROUND_2.md) — Round 2: 7 residual issues identified and fixed
- [INITIAL_PROMPT.md](INITIAL_PROMPT.md) — Original project specification
