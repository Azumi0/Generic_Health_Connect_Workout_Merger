# Generic Health Connect Workout Merger

A modular **React Native** application built with the **Expo framework** (`expo prebuild`) and **Material Design 3** (`react-native-paper`). The app detects, merges, and deduplicates overlapping workout sessions in **Google Health Connect** across any fitness tracking vendors (Garmin, Strava, Google Fit, Samsung Health, etc.).

---

## 🌟 Key Features

* **Generic Overlap Detection:** Scans for any exercise sessions (`ExerciseSession`) that overlap in duration or occur within a customizable tolerance window (e.g. +/- 1 to 15 minutes).
* **Smart Data Aggregation:**
  * Master session adopts the **earliest start time** and **latest end time** across all duplicate sessions in a cluster.
  * Consolidates title, notes, and exercise types.
  * Re-associates all child records (**Heart Rate**, **Distance**, **Speed**, **Active Calories**, **Total Calories**) with the new master workout.
  * Deduplicates identical sample entries and strips native metadata before insertion.
* **Automatic Cleanup:** Safely deletes original duplicate workout sessions from Google Health Connect after successful master session persistence.
* **Material Design 3 Interface:** Built using `react-native-paper` with conflict indicators, metric counters, scan range filters (3, 7, 30 days), and single-click merge approval.
* **Granular Permission Handling:** Integrated permission checks and requests for READ/WRITE access to exercise sessions and sub-metrics.

---

## 🛠 Tech Stack

* **Framework:** [Expo](https://expo.dev/) (Expo Development Builds / `expo prebuild`)
* **Core:** React Native, TypeScript (Strict Mode)
* **Health API:** [`react-native-health-connect`](https://github.com/matinzd/react-native-health-connect)
* **UI Layer:** [`react-native-paper`](https://callstack.github.io/react-native-paper/) (Material Design 3)
* **Date Utilities:** [`date-fns`](https://date-fns.org/)

---

## 📁 Project Structure

```
Generic_Health_Connect_Workout_Merger/
├── app.json                       # Expo config & Health Connect permissions
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── index.js                       # Entry point
├── types.ts                       # TypeScript interfaces & Health Connect constants
├── services/
│   └── HealthConnectService.ts    # Health Connect API integration service
├── utils/
│   └── MergeAlgorithm.ts          # Pure chronological overlap & merge logic
├── components/
│   └── SessionList.tsx            # MD3 conflict card list component
└── App.tsx                        # Root app with MD3 provider, permissions, & settings
```

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18 or later)
2. **pnpm** (v9+ / v11+)
3. **Android Studio & SDK** with Health Connect installed (or an Android device with Android 14+ / Health Connect app).

### Installation

```bash
# 1. Install dependencies using pnpm
pnpm install

# 2. Generate native Android folder with prebuild (required for native Health Connect module)
pnpm expo prebuild

# 3. Run on Android device or emulator
pnpm expo run:android
```

---

## 🔒 Permissions & Configuration

The app configures Health Connect permissions in `app.json` via the `react-native-health-connect` plugin:

* `android.permission.health.READ_EXERCISE` & `WRITE_EXERCISE`
* `android.permission.health.READ_HEART_RATE` & `WRITE_HEART_RATE`
* `android.permission.health.READ_DISTANCE` & `WRITE_DISTANCE`
* `android.permission.health.READ_SPEED` & `WRITE_SPEED`
* `android.permission.health.READ_TOTAL_CALORIES_BURNED` & `WRITE_TOTAL_CALORIES_BURNED`
* `android.permission.health.READ_ACTIVE_CALORIES_BURNED` & `WRITE_ACTIVE_CALORIES_BURNED`

---

## 🧪 Testing the Merge Logic

You can run the algorithm unit test script:

```bash
npx tsx /home/przemek/.gemini/antigravity-cli/brain/7975613a-e217-4e5d-9857-c267955fc354/scratch/test_merge.ts
```

---

## 📄 License

MIT License
