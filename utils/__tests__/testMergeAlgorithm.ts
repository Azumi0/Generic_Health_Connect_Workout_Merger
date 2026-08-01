import { ActivityCategory, ActivityCategoryLabel, DetailedWorkoutSession } from '../../types';
import { formatExerciseType, getSubRecordSummaries } from '../FormatUtils';
import {
  detectActivityCategory,
  generateMergedWorkoutPayload,
  groupOverlappingSessions,
  deduplicateRecords,
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
          metadata: { id: 'dist_treadmill_01', dataOrigin: 'com.merit.sport' },
        } as any,
      ],
      speedRecords: [],
      totalCaloriesRecords: [
        {
          recordType: 'TotalCaloriesBurned',
          startTime: '2026-07-29T10:00:00.000Z',
          endTime: '2026-07-29T10:30:00.000Z',
          energy: { inKilocalories: 140, inCalories: 140000, value: 140, unit: 'kilocalories' },
          metadata: { id: 'cal_treadmill_01', dataOrigin: 'com.merit.sport' },
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
          metadata: { id: 'hr_smartwatch_01', dataOrigin: 'com.sec.android.app.shealth' },
        } as any,
      ],
      distanceRecords: [
        {
          recordType: 'Distance',
          startTime: '2026-07-29T10:02:00.000Z',
          endTime: '2026-07-29T10:29:00.000Z',
          distance: { inMeters: 20, inKilometers: 0.02, value: 0.02, unit: 'kilometers' },
          metadata: { id: 'dist_smartwatch_02', dataOrigin: 'com.sec.android.app.shealth' },
        } as any,
      ],
      speedRecords: [],
      totalCaloriesRecords: [
        {
          recordType: 'TotalCaloriesBurned',
          startTime: '2026-07-29T10:02:00.000Z',
          endTime: '2026-07-29T10:29:00.000Z',
          energy: { inKilocalories: 359, inCalories: 359000, value: 359, unit: 'kilocalories' },
          metadata: { id: 'cal_smartwatch_02', dataOrigin: 'com.sec.android.app.shealth' },
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

  it('should detect overlapping sessions and form a conflict group with unique ID', () => {
    const conflictGroups = groupOverlappingSessions([sessionA, sessionB]);
    expect(conflictGroups).toHaveLength(1);
    expect(conflictGroups[0].status).toBe('conflict_detected');
    expect(conflictGroups[0].id).toContain('session_smartwatch_002');
    expect(conflictGroups[0].id).toContain('session_treadmill_001');
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
    expect(payload.originalSubRecordIdsToDelete).toBeDefined();
    expect(payload.originalSubRecordIdsToDelete!.length).toBeGreaterThan(0);
  });

  it('should throw when attempting to merge a single workout session', () => {
    const conflictGroups = groupOverlappingSessions([sessionA]);
    expect(() =>
      generateMergedWorkoutPayload(conflictGroups[0], [sessionA.session.metadata!.id!])
    ).toThrow('Cannot merge a single workout session. Select at least 2 sessions to merge.');
  });

  it('should not deduplicate sub-records from different origins with same timestamp', () => {
    const records = [
      {
        startTime: '2026-07-29T10:00:00.000Z',
        endTime: '2026-07-29T10:30:00.000Z',
        distance: { inMeters: 2000 },
        metadata: { dataOrigin: 'com.merit.sport', id: 'dist_001' },
      },
      {
        startTime: '2026-07-29T10:00:00.000Z',
        endTime: '2026-07-29T10:30:00.000Z',
        distance: { inMeters: 1800 },
        metadata: { dataOrigin: 'com.sec.android.app.shealth', id: 'dist_002' },
      },
    ];

    const result = deduplicateRecords(records);
    expect(result).toHaveLength(2);
  });

  it('should use majority vote for activity category detection', () => {
    const outdoorSession1: DetailedWorkoutSession = {
      ...sessionB,
      session: { ...sessionB.session, exerciseType: 56, title: 'Outdoor Run 1' },
    };
    const outdoorSession2: DetailedWorkoutSession = {
      ...sessionB,
      session: { ...sessionB.session, exerciseType: 56, title: 'Outdoor Run 2' },
    };

    // 2 outdoor sessions vs 1 indoor treadmill session -> majority vote chooses OUTDOOR_SPATIAL
    const cat = detectActivityCategory([outdoorSession1, outdoorSession2, sessionA]);
    expect(cat.category).toBe(ActivityCategory.OUTDOOR_SPATIAL);
  });

  it('should prefer indoor category on a tie between indoor and outdoor', () => {
    const outdoorSession: DetailedWorkoutSession = {
      ...sessionB,
      session: { ...sessionB.session, exerciseType: 56, title: 'Outdoor Run' },
    };

    // 1 indoor + 1 outdoor -> tie break prefers INDOOR_MACHINE
    const cat = detectActivityCategory([sessionA, outdoorSession]);
    expect(cat.category).toBe(ActivityCategory.INDOOR_MACHINE);
  });

  it('should use the supplied translator for the merged workout title fallback', () => {
    const noTitleSessionA = {
      ...sessionA,
      session: {
        ...sessionA.session,
        title: '',
      },
    } as DetailedWorkoutSession;

    const noTitleSessionB = {
      ...sessionB,
      session: {
        ...sessionB.session,
        title: '',
      },
    } as DetailedWorkoutSession;

    const conflictGroups = groupOverlappingSessions([noTitleSessionA, noTitleSessionB]);
    const payload = generateMergedWorkoutPayload(conflictGroups[0], undefined, {
      t: (key: string) => {
        if (key === 'sessionList.mergedWorkoutDefaultTitle') return 'Scalony trening';
        if (key === 'categories.indoorTreadmill') return 'Bieżnia stacjonarna';
        return key;
      },
    });

    expect(payload.sessionToInsert.title).toBe('Scalony trening (Bieżnia stacjonarna)');
  });

  describe('FormatUtils Helpers', () => {
    it('should format exercise types correctly', () => {
      expect(formatExerciseType(57)).toBe('Treadmill Running');
      expect(formatExerciseType(8)).toBe('Biking / Cycling');
    });

    it('should summarize sub-records correctly with explicit details', () => {
      const subSummaries = getSubRecordSummaries(sessionB.subRecords);
      expect(subSummaries.length).toBeGreaterThan(0);
      const hrSummary = subSummaries.find((s) => s.name === 'Heart Rate Records');
      expect(hrSummary).toBeDefined();
      expect(hrSummary?.count).toBe(1);
      expect(hrSummary?.details).toContain('99 bpm');
    });
  });
});
