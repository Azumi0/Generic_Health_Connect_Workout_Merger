# Generic Health Connect Workout Merger

A modular **React Native** application built with the **Expo framework** (`expo prebuild`) and **Material Design 3** (`react-native-paper`). The app detects, merges, and deduplicates overlapping workout sessions in **Google Health Connect** recorded by different devices or apps (e.g., Treadmill App, Smartwatch, GPS Computer) without double-counting physical effort.

---

## 🌟 Key Features

* **Generic Overlap Detection:** Scans for exercise sessions (`ExerciseSession`) that overlap in duration or fall within a customizable time tolerance window (e.g. +/- 1 to 15 minutes).
* **Activity Category Detection:** Automatically categorizes overlapping workout sessions into core activity profiles:
  * 🏃 **`INDOOR_MACHINE`**: Treadmill, Stationary Bike, Ergometer/Rower, Elliptical.
  * 🗺️ **`OUTDOOR_SPATIAL`**: Outdoor Running, Cycling, Hiking, Open Water Swim.
  * 🏋️ **`STATIONARY_NON_DISTANCE`**: Strength Training, Yoga, HIIT, Pilates, Boxing.
* **Sensor Quality Hierarchy & Conflict Resolution:**
  * **Heart Rate (HR):** Prioritizes continuous optical PPG / chest strap sensors over machine grips.
  * **Calorie Burn:** Selects a **single authoritative calorie stream** from the wearable HR estimate and **discards secondary calorie streams** to prevent double-counting in Google Health Connect.
  * **Distance Noise Filtering:** For indoor equipment workouts, machine belt telemetry overrides wrist swing estimates. Wrist distance is discarded if `< 0.10 km` or `< 10%` of machine distance over the same duration.
  * **Stationary Workouts:** Discards spatial estimations and forces distance to `0.00 km`.
* **UI Transparency & Attribution:** Surfaces activity category badges (`categoryLabel`), live merged metric previews, and metric-by-metric source attribution (`contributingSources`).
* **Automatic Cleanup:** Safely inserts the merged master workout session and deletes original duplicate exercise sessions from Google Health Connect.

---

## 🔬 Detailed Merging & Conflict Resolution Logic

When two or more candidate workout sessions (`Session_A`, `Session_B`) overlap in time, the algorithm executes in two distinct phases:

### Phase 1: Activity Category Detection
The sessions are evaluated based on Health Connect `exerciseType` IDs, metadata strings (titles, notes, data origin packages), and available metric streams:

1. **`INDOOR_MACHINE`** (Treadmill, Stationary Bike, Ergometer, Elliptical):
   - Telemetry priority: Equipment belt/flywheel revolutions for distance, Wearable PPG/Chest Strap for HR & Calories.
2. **`OUTDOOR_SPATIAL`** (Outdoor Run, Ride, Hike, Open Water Swim):
   - Telemetry priority: Smartwatch/Phone GPS for distance & route, Wearable PPG/Chest Strap for HR & Calories.
3. **`STATIONARY_NON_DISTANCE`** (Strength Training, Yoga, HIIT, Pilates, Boxing):
   - Telemetry priority: Wearable PPG/Chest Strap for physiological intensity & duration. Distance is set to `0.00 km`.

---

### Phase 2: Field-Level Metric Hierarchy & Patching

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      OVERLAPPING WORKOUT SESSIONS                       │
 │  Session A (Treadmill App): Dist 2.00km | HR null  | Cal 140kcal      │
 │  Session B (Smartwatch App): Dist 0.02km | HR 99bpm| Cal 359kcal      │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                        1. DETECT ACTIVITY CATEGORY
                                     │
                        ┌────────────▼────────────┐
                        │     INDOOR_MACHINE      │
                        └────────────┬────────────┘
                                     │
                       2. CONFLICT RESOLUTION RULES
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
   DISTANCE RULE               HEART RATE RULE             CALORIE RULE
   - Treadmill Belt > Wrist    - Wearable PPG > Machine    - Single Stream
   - 0.02km Wrist Noise        - Select 99 bpm HR          - Select 359 kcal
     filtered out              - Discard Machine Grip        from Smartwatch
   - Select 2.00 km Telemetry                              - DISCARD 140 kcal
                                                             Secondary Stream
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                      3. FINAL MERGED OUTPUT PAYLOAD
                                     │
        ┌────────────────────────────▼────────────────────────────┐
        │ Category: INDOOR_MACHINE ("Indoor Treadmill")           │
        │ Distance: 2.00 km | HR: 99 bpm | Calories: 359 kcal       │
        │ Attribution:                                            │
        │   - Distance: Treadmill App (MERACH)                    │
        │   - Heart Rate & Calories: Smartwatch App (Samsung)     │
        └─────────────────────────────────────────────────────────┘
```

#### 1. Heart Rate (HR)
* **Priority:** Continuous Optical PPG / Chest Strap (Wearable) > Machine Grip Sensors > Null.
* Continuous wearable HR samples take absolute priority over generic machine grip sensors.

#### 2. Calorie Burn (Energy Expenditure)
* **Priority:** Wearable HR-based Estimate > Direct Work/Power Measurement > Speed/Duration Formula.
* **Single-Stream Rule:** A single master calorie stream is chosen for the overlapping window (`Master_Calorie_Source = Wearable`). Secondary calorie streams are **discarded** to prevent double-counting when writing to Google Health Connect.

#### 3. Distance & Telemetry Noise Filtering
* **For `INDOOR_MACHINE`:**
  * **Priority:** Equipment Telemetry (Belt/Flywheel) > Wearable Wrist Swing.
  * **Noise Threshold Rule:** Discard wearable distance if it is `< 0.10 km` or `< 10%` of machine distance over the same duration (`wearableDist < 0.10 * machineDist`).
* **For `OUTDOOR_SPATIAL`:**
  * **Priority:** Smartwatch/Phone GPS > Wearable Step Estimation.
* **For `STATIONARY_NON_DISTANCE`:**
  * **Priority:** Force `Distance = 0.00 km` (discards spatial estimations).

---

## 🛠 Tech Stack

* **Framework:** [Expo](https://expo.dev/) (Expo Development Builds / `expo prebuild`)
* **Core:** React Native, TypeScript (Strict Mode)
* **Health API:** [`react-native-health-connect`](https://github.com/matinzd/react-native-health-connect)
* **UI Layer:** [`react-native-paper`](https://callstack.github.io/react-native-paper/) (Material Design 3)
* **Date Utilities:** [`date-fns`](https://date-fns.org/)
* **Package Manager:** `pnpm`

---

## 📁 Project Structure

```
Generic_Health_Connect_Workout_Merger/
├── app.json                       # Expo config & Health Connect permissions
├── package.json                   # Dependencies and scripts
├── pnpm-lock.yaml                 # Authoritative pnpm lockfile
├── tsconfig.json                  # Strict TypeScript configuration
├── AGENTS.md                      # AI agent instructions & codebase conventions
├── types.ts                       # TypeScript interfaces, ActivityCategory enum, & permissions
├── services/
│   └── HealthConnectService.ts    # Google Health Connect API wrapper service
├── utils/
│   ├── FormatUtils.ts             # Package origin formatting & metric aggregations
│   ├── MergeAlgorithm.ts          # Pure category detection, overlap clustering & payload merge logic
│   └── __tests__/
│       └── testMergeAlgorithm.ts  # Test suite for merge algorithm, category detection & noise rules
├── components/
│   └── SessionList.tsx            # MD3 conflict card component with metric attribution & badges
└── App.tsx                        # Root app with MD3 provider, permissions, & settings
```

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18 or later)
2. **pnpm** (`corepack enable` or `npm install -g pnpm`)
3. **Android Studio & SDK** with Health Connect installed (or an Android device running Android 14+ / Health Connect app).

### Installation & Run

```bash
# 1. Install dependencies using pnpm
pnpm install

# 2. Generate native Android folder with prebuild (required for native Health Connect SDK)
pnpm expo prebuild

# 3. Run on Android device or emulator
pnpm expo run:android
```

---

## 🧪 Testing & Verification

Run the TypeScript typechecker and the automated test suite:

```bash
# Run strict TypeScript typecheck
pnpm run typecheck

# Run unit tests for merge algorithm, category detection, & noise filtering
pnpm run test
```

---

## 📄 License

MIT License
