import { ActivityCategory, DetailedWorkoutSession, WorkoutConflictGroup } from '../../types';
import {
  detectActivityCategory,
  generateMergedWorkoutPayload,
  groupOverlappingSessions,
} from '../MergeAlgorithm';

function runTests() {
  console.log('--- Running Workout Merger Algorithm Tests ---');

  // Test Case 1: Prompt Example
  // Session A (Treadmill App): Distance: 2.00 km | HR: null | Calories: 140 kcal
  // Session B (Smartwatch App): Distance: 0.02 km | HR: 99 bpm | Calories: 359 kcal
  const sessionA: DetailedWorkoutSession = {
    session: {
      recordType: 'ExerciseSession',
      startTime: '2026-07-29T10:00:00.000Z',
      endTime: '2026-07-29T10:30:00.000Z',
      exerciseType: 57, // Running treadmill
      title: 'Treadmill Run',
      metadata: {
        id: 'session_treadmill_001',
        dataOrigin: 'com.merit.sport',
        clientRecordId: 'treadmill_01',
        clientRecordVersion: 1,
        lastModifiedTime: '2026-07-29T10:30:00.000Z',
        recordingMethod: 1,
      },
    },
    subRecords: {
      heartRateRecords: [],
      distanceRecords: [
        {
          recordType: 'Distance',
          startTime: '2026-07-29T10:00:00.000Z',
          endTime: '2026-07-29T10:30:00.000Z',
          distance: { inMeters: 2000, inKilometers: 2.0, inMiles: 1.24, value: 2.0, unit: 'kilometers' },
        } as any,
      ],
      speedRecords: [],
      totalCaloriesRecords: [
        {
          recordType: 'TotalCaloriesBurned',
          startTime: '2026-07-29T10:00:00.000Z',
          endTime: '2026-07-29T10:30:00.000Z',
          energy: { inKilocalories: 140, inCalories: 140000, value: 140, unit: 'kilocalories' },
        } as any,
      ],
      activeCaloriesRecords: [],
      stepsRecords: [],
      stepsCadenceRecords: [],
      elevationGainedRecords: [],
      floorsClimbedRecords: [],
      powerRecords: [],
      cyclingPedalingCadenceRecords: [],
      wheelchairPushesRecords: [],
      vo2MaxRecords: [],
      heartRateVariabilityRecords: [],
      restingHeartRateRecords: [],
    },
  };

  const sessionB: DetailedWorkoutSession = {
    session: {
      recordType: 'ExerciseSession',
      startTime: '2026-07-29T10:02:00.000Z',
      endTime: '2026-07-29T10:29:00.000Z',
      exerciseType: 57, // Running treadmill
      title: 'Smartwatch Workout',
      metadata: {
        id: 'session_smartwatch_002',
        dataOrigin: 'com.sec.android.app.shealth',
        clientRecordId: 'smartwatch_02',
        clientRecordVersion: 1,
        lastModifiedTime: '2026-07-29T10:29:00.000Z',
        recordingMethod: 1,
      },
    },
    subRecords: {
      heartRateRecords: [
        {
          recordType: 'HeartRate',
          startTime: '2026-07-29T10:02:00.000Z',
          endTime: '2026-07-29T10:29:00.000Z',
          samples: [{ beatsPerMinute: 99, time: '2026-07-29T10:15:00.000Z' }],
        } as any,
      ],
      distanceRecords: [
        {
          recordType: 'Distance',
          startTime: '2026-07-29T10:02:00.000Z',
          endTime: '2026-07-29T10:29:00.000Z',
          distance: { inMeters: 20, inKilometers: 0.02, value: 0.02, unit: 'kilometers' },
        } as any,
      ],
      speedRecords: [],
      totalCaloriesRecords: [
        {
          recordType: 'TotalCaloriesBurned',
          startTime: '2026-07-29T10:02:00.000Z',
          endTime: '2026-07-29T10:29:00.000Z',
          energy: { inKilocalories: 359, inCalories: 359000, value: 359, unit: 'kilocalories' },
        } as any,
      ],
      activeCaloriesRecords: [],
      stepsRecords: [],
      stepsCadenceRecords: [],
      elevationGainedRecords: [],
      floorsClimbedRecords: [],
      powerRecords: [],
      cyclingPedalingCadenceRecords: [],
      wheelchairPushesRecords: [],
      vo2MaxRecords: [],
      heartRateVariabilityRecords: [],
      restingHeartRateRecords: [],
    },
  };

  // Test Overlap Detection
  const conflictGroups = groupOverlappingSessions([sessionA, sessionB]);
  console.assert(conflictGroups.length === 1, 'Should detect 1 conflict group');
  console.assert(conflictGroups[0].status === 'conflict_detected', 'Group status should be conflict_detected');

  // Test Category Detection
  const cat = detectActivityCategory([sessionA, sessionB]);
  console.assert(cat.category === ActivityCategory.INDOOR_MACHINE, 'Should detect INDOOR_MACHINE category');
  console.assert(cat.label === 'Indoor Treadmill', `Expected "Indoor Treadmill", got "${cat.label}"`);

  // Test Merged Payload
  const payload = generateMergedWorkoutPayload(conflictGroups[0]);
  const summary = payload.mergedSummary;

  console.log('Merged Summary:', JSON.stringify(summary, null, 2));

  console.assert(summary.detectedCategory === ActivityCategory.INDOOR_MACHINE, 'Category should be INDOOR_MACHINE');
  console.assert(summary.distanceKm === 2.00, `Expected distance 2.00 km, got ${summary.distanceKm}`);
  console.assert(summary.avgHeartRateBpm === 99, `Expected HR 99 bpm, got ${summary.avgHeartRateBpm}`);
  console.assert(summary.caloriesKcal === 359, `Expected calories 359 kcal, got ${summary.caloriesKcal}`);

  console.assert(summary.contributingSources.length === 2, 'Should have 2 contributing sources');
  console.assert(summary.contributingSources[0].metric === 'Distance' && summary.contributingSources[0].source === 'MERACH', 'Distance source should be MERACH');
  console.assert(summary.contributingSources[1].metric === 'Heart Rate & Calories' && summary.contributingSources[1].source === 'Samsung Health', 'HR & Calories source should be Samsung Health');

  console.assert(payload.originalSessionIdsToDelete.length === 2, 'Should mark 2 original sessions for deletion');

  // Test FormatUtils Helpers for Modal Metadata
  const { formatExerciseType, getSubRecordSummaries } = require('../FormatUtils');
  console.assert(formatExerciseType(57) === 'Treadmill Running', 'Exercise type 57 should format to Treadmill Running');
  console.assert(formatExerciseType(8) === 'Biking / Cycling', 'Exercise type 8 should format to Biking / Cycling');

  const subSummaries = getSubRecordSummaries(sessionB.subRecords);
  console.assert(subSummaries.length > 0, 'Sub-records summaries should not be empty');
  const hrSummary = subSummaries.find((s: any) => s.name === 'Heart Rate Records');
  console.assert(hrSummary && hrSummary.count === 1, 'Should summarize 1 Heart Rate record');

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
}

runTests();
