# AGENTS.md

Guiding instructions and codebase conventions for AI agents and coding assistants working on **Generic Health Connect Workout Merger**.

---

## 📦 Package Management Rules

> [!IMPORTANT]
> **Strict Package Manager: `pnpm`**
> All package installations, script executions, and lockfile updates MUST use `pnpm`. Do NOT use `npm` or `yarn`.

### Standard Commands
* **Install dependencies:** `pnpm install`
* **Add a new dependency:** `pnpm add <package-name>`
* **Add a dev dependency:** `pnpm add -D <package-name>`
* **Execute local binaries:** `pnpm exec <command>` (e.g. `pnpm exec tsc --noEmit`)
* **Run Expo commands:** `pnpm expo <command>` or `npx expo <command>`

---

## 📁 Architecture Overview

```
Generic_Health_Connect_Workout_Merger/
├── app.json                       # Expo config, permissions, & react-native-health-connect plugin
├── package.json                   # Dependencies & pnpm lockfile configuration
├── pnpm-lock.yaml                 # Authoritative pnpm lockfile
├── tsconfig.json                  # TypeScript compiler settings (strict mode)
├── types.ts                       # Core interfaces & REQUIRED_HEALTH_PERMISSIONS constant
├── services/
│   └── HealthConnectService.ts    # Singleton wrapper for Google Health Connect API calls
├── utils/
│   └── MergeAlgorithm.ts          # Pure overlap detection & payload aggregation functions
├── components/
│   └── SessionList.tsx            # Material Design 3 UI component for displaying conflicts
├── docs/
│   └── INITIAL_PROMPT.md          # Preserved initial specification & project prompt
├── AGENTS.md                      # AI agent instructions (this document)
└── App.tsx                        # Main entry component with MD3 theme & dialogs
```

---

## 🔧 Codebase Standards

1. **TypeScript Strictness**:
   - Ensure `"strict": true` remains enabled in `tsconfig.json`.
   - Always declare explicit parameter types in callbacks and functions.
2. **Health Connect API Safety**:
   - Any new metric types requested from Health Connect MUST be declared in `app.json` under `android.permissions` and added to `REQUIRED_HEALTH_PERMISSIONS` in `types.ts`.
   - Sub-records MUST have their `metadata` property stripped before re-inserting into Health Connect during merge.
3. **UI Layer**:
   - Use Material Design 3 components from `react-native-paper`.
   - Follow `PaperProvider` theme tokens (`theme.colors.*`).

---

## 🧪 Verification & Typechecking

Before completing changes, verify that the TypeScript codebase compiles cleanly:

```bash
pnpm run typecheck
```
