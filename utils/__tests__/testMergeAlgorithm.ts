import { ActivityCategory, ActivityCategoryLabel, DetailedWorkoutSession } from '../../types';
import { formatExerciseType, getSubRecordSummaries } from '../FormatUtils';
import {
  detectActivityCategory,
  generateMergedWorkoutPayload,
  groupOverlappingSessions,
} from '../MergeAlgorithm';

describe('Workout Merger Algorithm', () => {
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

  it('should detect overlapping sessions and form a conflict group', () => {
    const conflictGroups = groupOverlappingSessions([sessionA, sessionB]);
    expect(conflictGroups).toHaveLength(1);
    expect(conflictGroups[0].status).toBe('conflict_detected');
  });

  it('should detect INDOOR_MACHINE category and INDOOR_TREADMILL label', () => {
    const cat = detectActivityCategory([sessionA, sessionB]);
    expect(cat.category).toBe(ActivityCategory.INDOOR_MACHINE);
    expect(cat.label).toBe(ActivityCategoryLabel.INDOOR_TREADMILL);
  });

  it('should generate a correctly merged workout payload and summary', () => {
    const conflictGroups = groupOverlappingSessions([sessionA, sessionB]);
    const payload = generateMergedWorkoutPayload(conflictGroups[0]);
    const summary = payload.mergedSummary;

    expect(summary.detectedCategory).toBe(ActivityCategory.INDOOR_MACHINE);
    expect(summary.distanceKm).toBe(2.0);
    expect(summary.avgHeartRateBpm).toBe(99);
    expect(summary.caloriesKcal).toBe(359);

    expect(summary.contributingSources).toHaveLength(2);
    expect(summary.contributingSources[0]).toEqual({
      metric: 'Distance',
      source: 'MERACH',
    });
    expect(summary.contributingSources[1]).toEqual({
      metric: 'Heart Rate & Calories',
      source: 'Samsung Health',
    });

    expect(payload.originalSessionIdsToDelete).toHaveLength(2);
  });

  describe('FormatUtils Helpers', () => {
    it('should format exercise types correctly', () => {
      expect(formatExerciseType(57)).toBe('Treadmill Running');
      expect(formatExerciseType(8)).toBe('Biking / Cycling');
    });

    it('should summarize sub-records correctly', () => {
      const subSummaries = getSubRecordSummaries(sessionB.subRecords);
      expect(subSummaries.length).toBeGreaterThan(0);
      const hrSummary = subSummaries.find((s) => s.name === 'Heart Rate Records');
      expect(hrSummary).toBeDefined();
      expect(hrSummary?.count).toBe(1);
    });
  });
});
