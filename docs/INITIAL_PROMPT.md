# Initial Project Specification & Prompt

> **Context Document**: Saved for project reference and auditing.

---

## Task Overview

You are a Senior React Native Developer and Software Architect. Your task is to build a React Native application using the Expo framework (specifically Expo Development Builds / `expo prebuild`) designed to generically merge and deduplicate overlapping workouts in Google Health Connect.

### Tech Stack:
* Expo, React Native, TypeScript (strict typing).
* `react-native-health-connect` for API communication.
* `react-native-paper` (Material Design 3) for the UI layer.
* `date-fns` or native `Date` objects for time manipulation.

---

## Business Requirements

1. **Generic Merging:** The app must not be limited to specific vendors. It should look for any workout sessions (`ExerciseSession`) that overlap in time, taking into account a user-defined error margin / time offset (e.g., a +/- 5 minute tolerance).
2. **Data Aggregation:** The new (merged) session should adopt the earliest start time and the latest end time from the group of duplicates. It must collect all related sub-records (Heart Rate, Distance, Speed, Calories, etc.) and assign them to the new master record.
3. **Cleanup:** After successfully saving the merged session, the original duplicated sessions must be deleted.
4. **UI (Material Design):** A clean interface displaying a list of days/workouts, highlighting detected conflicts, and allowing the user to approve the merge process with a single click.
5. **Permissions:** Proper handling of `AndroidManifest.xml` entries via Expo Config Plugins, as well as system-level requests for READ/WRITE access in Health Connect.

---

## Collaboration & Execution Strategy

Divided into 4 modular phases:

### Phase 1: Setup & Types
* Generate the `app.json` file including the plugin configuration for `react-native-health-connect`.
* Create a `types.ts` file with interfaces representing grouped training sessions and time tolerance parameters.

### Phase 2: Service Layer (Health Connect API)
* Create `services/HealthConnectService.ts`.
* Implement methods for: initialization, requesting permissions (READ/WRITE for key metrics), and fetching sessions along with their child records for a given time range.

### Phase 3: Merge Algorithm (Core Logic)
* Create `utils/MergeAlgorithm.ts`.
* Implement a pure function that takes a list of sessions, sorts them chronologically, and groups those whose durations overlap or are separated by less than `TOLERANCE_MS`.
* Implement a function that generates the final merged workout object with all data samples.
* Add a method in `HealthConnectService.ts` to save the new workout and delete the old ones based on their IDs.

### Phase 4: UI (Material Design with React Native Paper)
* Create `App.tsx` with the `PaperProvider` configuration.
* Create `components/SessionList.tsx` to display grouped conflicts (use MD3 components like Card, List.Item).
* Wire up the "Merge these workouts" button logic to the service layer.
