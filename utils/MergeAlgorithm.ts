import {
  DetailedWorkoutSession,
  WorkoutConflictGroup,
  MergedWorkoutPayload,
  ToleranceParams,
  ActivityCategory,
  MergedWorkoutSession,
  ContributingSource,
  ActivityCategoryLabel,
  WorkoutSubRecords,
} from '../types';
import {
  RecordType,
  HeartRateRecord,
  DistanceRecord,
  SpeedRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
  StepsRecord,
  StepsCadenceRecord,
  ElevationGainedRecord,
  FloorsClimbedRecord,
  PowerRecord,
  CyclingPedalingCadenceRecord,
  WheelchairPushesRecord,
  Vo2MaxRecord,
  HeartRateVariabilityRmssdRecord,
  RestingHeartRateRecord,
} from 'react-native-health-connect';
import { formatAppOrigin } from './FormatUtils';
import {
  extractDistanceMeters,
  extractCaloriesKcal,
  extractAvgHeartRateBpm,
} from './MetricExtractors';

export {
  extractDistanceMeters,
  extractCaloriesKcal,
  extractAvgHeartRateBpm,
} from './MetricExtractors';

export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance

const INDOOR_MACHINE_KEYWORDS = [
  'treadmill',
  'stationary bike',
  'indoor bike',
  'spinning',
  'ergometer',
  'rower',
  'rowing machine',
  'elliptical',
  'indoor cycle',
  'trainer',
  'indoor run',
  'indoor walk',
  'merach',
  'zwift',
  'peloton',
  'ifit',
];

const STATIONARY_KEYWORDS = [
  'strength',
  'weightlifting',
  'weight',
  'yoga',
  'pilates',
  'hiit',
  'boxing',
  'core',
  'crossfit',
  'stretching',
  'calisthenics',
  'gym',
  'workout',
  'dumbbell',
  'barbell',
  'bodyweight',
];

const OUTDOOR_KEYWORDS = [
  'outdoor',
  'gps',
  'trail',
  'hike',
  'road run',
  'road ride',
  'open water',
  'strava',
  'komoot',
  'wahoo',
];

/**
 * Pure function to detect Activity Category based on session metadata, exercise types, and telemetry.
 * Uses a majority-vote algorithm across all overlapping sessions in the group.
 * On a tie, indoor equipment > outdoor spatial > stationary non-distance.
 * Supports manual user override via overrideCategory parameter.
 */
export function detectActivityCategory(
  sessions: DetailedWorkoutSession[],
  overrideCategory?: ActivityCategory
): {
  category: ActivityCategory;
  label: ActivityCategoryLabel;
} {
  if (overrideCategory) {
    let label = ActivityCategoryLabel.STATIONARY_ACTIVITY;
    if (overrideCategory === ActivityCategory.INDOOR_MACHINE) {
      label = ActivityCategoryLabel.INDOOR_EQUIPMENT;
    } else if (overrideCategory === ActivityCategory.OUTDOOR_SPATIAL) {
      label = ActivityCategoryLabel.OUTDOOR_GPS_TRACK;
    } else if (overrideCategory === ActivityCategory.STATIONARY_NON_DISTANCE) {
      label = ActivityCategoryLabel.STATIONARY_STRENGTH;
    }
    return {
      category: overrideCategory,
      label,
    };
  }

  if (!sessions || sessions.length === 0) {
    return {
      category: ActivityCategory.STATIONARY_NON_DISTANCE,
      label: ActivityCategoryLabel.STATIONARY_ACTIVITY,
    };
  }

  let indoorCount = 0;
  let stationaryCount = 0;
  let outdoorCount = 0;
  let specificMachineLabel: ActivityCategoryLabel | undefined;

  for (const item of sessions) {
    const exType = item.session.exerciseType;
    const title = (item.session.title || '').toLowerCase();
    const notes = (item.session.notes || '').toLowerCase();
    const origin = (item.session.metadata?.dataOrigin || '').toLowerCase();
    const textCombined = `${title} ${notes} ${origin}`;

    const isIndoorType =
      [57, 80, 9, 54, 25, 69].includes(exType) ||
      INDOOR_MACHINE_KEYWORDS.some((kw) => textCombined.includes(kw));

    const isStationaryType =
      [73, 81, 83, 47, 36, 11, 42, 13, 34, 67].includes(exType) ||
      STATIONARY_KEYWORDS.some((kw) => textCombined.includes(kw));

    const isOutdoorType =
      [56, 8, 79, 37, 74].includes(exType) ||
      OUTDOOR_KEYWORDS.some((kw) => textCombined.includes(kw));

    if (isIndoorType) {
      indoorCount++;
      if (!specificMachineLabel) {
        if (textCombined.includes('treadmill') || exType === 57 || exType === 80) {
          specificMachineLabel = ActivityCategoryLabel.INDOOR_TREADMILL;
        } else if (textCombined.includes('bike') || textCombined.includes('spinning') || exType === 9) {
          specificMachineLabel = ActivityCategoryLabel.INDOOR_EQUIPMENT;
        } else if (textCombined.includes('row') || textCombined.includes('ergometer') || exType === 54) {
          specificMachineLabel = ActivityCategoryLabel.INDOOR_EQUIPMENT;
        } else if (textCombined.includes('elliptical') || exType === 25) {
          specificMachineLabel = ActivityCategoryLabel.INDOOR_EQUIPMENT;
        }
      }
    } else if (isStationaryType) {
      stationaryCount++;
    } else if (isOutdoorType) {
      outdoorCount++;
    }
  }

  // Majority-vote: pick the category with the most matching sessions.
  // On a tie, prefer indoor > outdoor > stationary.
  const candidates: Array<{
    count: number;
    category: ActivityCategory;
    label: ActivityCategoryLabel;
  }> = [];

  if (indoorCount > 0) {
    candidates.push({
      count: indoorCount,
      category: ActivityCategory.INDOOR_MACHINE,
      label: specificMachineLabel || ActivityCategoryLabel.INDOOR_EQUIPMENT,
    });
  }
  if (outdoorCount > 0) {
    candidates.push({
      count: outdoorCount,
      category: ActivityCategory.OUTDOOR_SPATIAL,
      label: ActivityCategoryLabel.OUTDOOR_GPS_TRACK,
    });
  }
  if (stationaryCount > 0) {
    candidates.push({
      count: stationaryCount,
      category: ActivityCategory.STATIONARY_NON_DISTANCE,
      label: ActivityCategoryLabel.STATIONARY_STRENGTH,
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.count - a.count);
    return {
      category: candidates[0].category,
      label: candidates[0].label,
    };
  }

  // Fallback based on sub-records presence
  const hasDistance = sessions.some(
    (s) => extractDistanceMeters(s.subRecords.distanceRecords) > 50
  );

  if (hasDistance) {
    return {
      category: ActivityCategory.OUTDOOR_SPATIAL,
      label: ActivityCategoryLabel.OUTDOOR_SPATIAL,
    };
  }

  return {
    category: ActivityCategory.STATIONARY_NON_DISTANCE,
    label: ActivityCategoryLabel.STATIONARY_ACTIVITY,
  };
}

/**
 * Checks if a session originates from a wearable device (Smartwatch/Chest Strap) with optical PPG/HR sensors.
 */
export function isWearableSession(s: DetailedWorkoutSession): boolean {
  const origin = (s.session.metadata?.dataOrigin || '').toLowerCase();
  const title = (s.session.title || '').toLowerCase();
  const knownWearablePackages = [
    'shealth',
    'garmin',
    'polar',
    'fitbit',
    'zepp',
    'huami',
    'apple',
    'watch',
    'wearable',
    'fitness',
  ];

  const hasHeartRate = s.subRecords.heartRateRecords && s.subRecords.heartRateRecords.length > 0;
  const isWearableApp = knownWearablePackages.some((pkg) => origin.includes(pkg));
  const isSmartwatchTitle = title.includes('watch') || title.includes('smartwatch');

  return hasHeartRate || isWearableApp || isSmartwatchTitle;
}

/**
 * Checks if a session originates from an equipment telemetry machine app (Treadmill, Stationary Bike, Rower).
 * @param groupCategory Optional category detected for the group to gate distance-without-HR fallback.
 */
export function isMachineSession(
  s: DetailedWorkoutSession,
  groupCategory?: ActivityCategory
): boolean {
  const origin = (s.session.metadata?.dataOrigin || '').toLowerCase();
  const title = (s.session.title || '').toLowerCase();
  const knownMachinePackages = [
    'merit',
    'merach',
    'zwift',
    'peloton',
    'ifit',
    'treadmill',
    'concept2',
    'echelon',
  ];

  const isMachineApp = knownMachinePackages.some((pkg) => origin.includes(pkg));
  const isMachineTitle =
    title.includes('treadmill') ||
    title.includes('bike') ||
    title.includes('rower') ||
    title.includes('ergometer') ||
    title.includes('elliptical');

  const hasDistance = s.subRecords.distanceRecords && s.subRecords.distanceRecords.length > 0;
  const noHeartRate = !s.subRecords.heartRateRecords || s.subRecords.heartRateRecords.length === 0;

  // Only apply the distance-without-HR fallback if the group is classified as indoor machine.
  // Otherwise a phone-only outdoor run (no HR sensor) would be misclassified as a machine.
  const distanceFallback =
    groupCategory === ActivityCategory.INDOOR_MACHINE && hasDistance && noHeartRate;

  return isMachineApp || isMachineTitle || distanceFallback;
}

/**
 * Pure function to detect overlapping workout sessions within a given tolerance.
 */
export function groupOverlappingSessions(
  sessions: DetailedWorkoutSession[],
  params: ToleranceParams = { toleranceMs: DEFAULT_TOLERANCE_MS }
): WorkoutConflictGroup[] {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime()
  );

  const groups: WorkoutConflictGroup[] = [];
  let currentGroup: DetailedWorkoutSession[] = [sorted[0]];

  let currentEarliest = new Date(sorted[0].session.startTime).getTime();
  let currentLatest = new Date(sorted[0].session.endTime).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const nextSession = sorted[i];
    const nextStart = new Date(nextSession.session.startTime).getTime();
    const nextEnd = new Date(nextSession.session.endTime).getTime();

    if (nextStart <= currentLatest + params.toleranceMs) {
      currentGroup.push(nextSession);
      if (nextEnd > currentLatest) {
        currentLatest = nextEnd;
      }
      if (nextStart < currentEarliest) {
        currentEarliest = nextStart;
      }
    } else {
      groups.push(buildConflictGroup(currentGroup, currentEarliest, currentLatest));

      currentGroup = [nextSession];
      currentEarliest = nextStart;
      currentLatest = nextEnd;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(buildConflictGroup(currentGroup, currentEarliest, currentLatest));
  }

  return groups;
}

/**
 * Constructs a WorkoutConflictGroup structure with category label and merged preview.
 * Group IDs incorporate sorted constituent session IDs to ensure uniqueness.
 */
function buildConflictGroup(
  sessions: DetailedWorkoutSession[],
  earliestTimeMs: number,
  latestTimeMs: number
): WorkoutConflictGroup {
  const firstSession = sessions[0].session;
  const exerciseTypes = new Set(sessions.map((s) => s.session.exerciseType));
  const hasMultipleExerciseTypes = exerciseTypes.size > 1;
  const status = sessions.length > 1 ? ('conflict_detected' as const) : ('ignored' as const);

  const { category, label: categoryLabel } = detectActivityCategory(sessions);

  const sessionIdPart = sessions
    .map((s, i) => s.session.metadata?.id || `idx${i}`)
    .sort()
    .join('_');

  const tempGroup: WorkoutConflictGroup = {
    id: `group_${earliestTimeMs}_${latestTimeMs}_${sessionIdPart}`,
    sessions,
    earliestStartTime: new Date(earliestTimeMs).toISOString(),
    latestEndTime: new Date(latestTimeMs).toISOString(),
    exerciseType: firstSession.exerciseType,
    hasMultipleExerciseTypes,
    status,
    detectedCategory: category,
    categoryLabel,
  };

  let mergedPreview: MergedWorkoutSession | undefined;
  if (sessions.length > 1) {
    try {
      const payload = generateMergedWorkoutPayload(tempGroup);
      mergedPreview = payload.mergedSummary;
    } catch {
      // Ignore preview errors during group construction
    }
  }

  return {
    ...tempGroup,
    mergedPreview,
  };
}

export interface MergePayloadOptions {
  t?: (key: string, params?: Record<string, string | number>) => string;
  overrideCategory?: ActivityCategory;
}

/**
 * Pure function that generates the payload for inserting a merged master workout session
 * adhering strictly to sensor quality hierarchy, single calorie stream, and noise threshold rules.
 */
export function generateMergedWorkoutPayload(
  group: WorkoutConflictGroup,
  selectedSessionIds?: string[] | undefined,
  options?: MergePayloadOptions
): MergedWorkoutPayload {
  const sessionsToMerge = selectedSessionIds
    ? group.sessions.filter((s, index) => {
        const id = s.session.metadata?.id || `sess_${index}`;
        return selectedSessionIds.includes(id);
      })
    : group.sessions;

  if (sessionsToMerge.length === 0) {
    throw new Error('Cannot merge an empty selection of workouts');
  }

  if (sessionsToMerge.length === 1) {
    throw new Error(
      'Cannot merge a single workout session. Select at least 2 sessions to merge.'
    );
  }

  // 1. DETECT CATEGORY (with manual user override support)
  const { category, label: categoryLabel } = detectActivityCategory(
    sessionsToMerge,
    options?.overrideCategory
  );

  // 2. SELECT MASTER & SECONDARY SOURCES
  const wearableSession = sessionsToMerge.find(isWearableSession);
  const machineSession = sessionsToMerge.find((s) => isMachineSession(s, category));

  let masterCalorieSession: DetailedWorkoutSession = wearableSession || sessionsToMerge[0];
  let masterDistanceSession: DetailedWorkoutSession | null = sessionsToMerge[0];
  let masterHRSession: DetailedWorkoutSession = wearableSession || sessionsToMerge[0];

  if (category === ActivityCategory.INDOOR_MACHINE) {
    masterCalorieSession = wearableSession || sessionsToMerge[0];
    masterDistanceSession = machineSession || sessionsToMerge.find((s) => s !== wearableSession) || sessionsToMerge[0];
    masterHRSession = wearableSession || sessionsToMerge[0];
  } else if (category === ActivityCategory.OUTDOOR_SPATIAL) {
    masterCalorieSession = wearableSession || sessionsToMerge[0];
    masterDistanceSession =
      sessionsToMerge.find((s) => s.subRecords.distanceRecords && s.subRecords.distanceRecords.length > 0) ||
      sessionsToMerge[0];
    masterHRSession = wearableSession || sessionsToMerge[0];
  } else if (category === ActivityCategory.STATIONARY_NON_DISTANCE) {
    masterCalorieSession = wearableSession || sessionsToMerge[0];
    masterDistanceSession = null; // Set Distance = 0.00
    masterHRSession = wearableSession || sessionsToMerge[0];
  }

  // 3. CONFLICT RESOLUTION
  // - Heart Rate: Continuous optical PPG / Chest strap from Wearable
  const rawHeartRate = masterHRSession.subRecords.heartRateRecords || [];

  // - Calories: SINGLE authoritative calorie stream from Master_Calorie_Source, DISCARD secondary calories
  const rawTotalCalories = masterCalorieSession.subRecords.totalCaloriesRecords || [];
  const rawActiveCalories = masterCalorieSession.subRecords.activeCaloriesRecords || [];

  // - Distance & Telemetry Noise Filtering:
  let rawDistance: DistanceRecord[] = [];
  if (category === ActivityCategory.INDOOR_MACHINE && masterDistanceSession) {
    const machineDistMeters = extractDistanceMeters(masterDistanceSession.subRecords.distanceRecords || []);
    const machineDistKm = machineDistMeters / 1000;

    let wearableDistKm = 0;
    if (wearableSession && wearableSession !== masterDistanceSession) {
      const wearableDistMeters = extractDistanceMeters(wearableSession.subRecords.distanceRecords || []);
      wearableDistKm = wearableDistMeters / 1000;
    }

    // Indoor Machine Telemetry Rule:
    // Discard wearable wrist-accelerometer distance if it is < 0.10 km or < 10% of machine belt distance (noise).
    // If wearable distance is significantly higher than machine distance (> 1.5x), the wearable has GPS lock (outdoor).
    if (wearableDistKm > 0 && (wearableDistKm < 0.10 || wearableDistKm < 0.10 * machineDistKm)) {
      rawDistance = masterDistanceSession.subRecords.distanceRecords || [];
    } else if (wearableDistKm > machineDistKm * 1.5 && wearableSession?.subRecords.distanceRecords) {
      rawDistance = wearableSession.subRecords.distanceRecords;
    } else if (masterDistanceSession.subRecords.distanceRecords.length > 0) {
      rawDistance = masterDistanceSession.subRecords.distanceRecords;
    } else if (wearableSession?.subRecords.distanceRecords) {
      rawDistance = wearableSession.subRecords.distanceRecords;
    }
  } else if (category === ActivityCategory.OUTDOOR_SPATIAL && masterDistanceSession) {
    rawDistance = masterDistanceSession.subRecords.distanceRecords || [];
  } else if (category === ActivityCategory.STATIONARY_NON_DISTANCE) {
    rawDistance = []; // Discard spatial estimations, force Distance = 0.00
  }

  // Secondary non-conflicting metrics aggregation
  const rawSpeed: SpeedRecord[] = masterDistanceSession?.subRecords.speedRecords || [];
  const rawPower: PowerRecord[] = [];
  const rawCyclingCadence: CyclingPedalingCadenceRecord[] = [];
  const rawSteps: StepsRecord[] = [];
  const rawStepsCadence: StepsCadenceRecord[] = [];
  const rawElevationGained: ElevationGainedRecord[] = [];
  const rawFloorsClimbed: FloorsClimbedRecord[] = [];
  const rawWheelchairPushes: WheelchairPushesRecord[] = [];
  const rawVo2Max: Vo2MaxRecord[] = [];
  const rawHrv: HeartRateVariabilityRmssdRecord[] = [];
  const rawRestingHeartRate: RestingHeartRateRecord[] = [];

  if (
    category === ActivityCategory.INDOOR_MACHINE &&
    masterDistanceSession?.subRecords.elevationGainedRecords &&
    masterDistanceSession.subRecords.elevationGainedRecords.length > 0
  ) {
    rawElevationGained.push(...masterDistanceSession.subRecords.elevationGainedRecords);
  } else {
    for (const item of sessionsToMerge) {
      if (item.subRecords.elevationGainedRecords) rawElevationGained.push(...item.subRecords.elevationGainedRecords);
    }
  }

  for (const item of sessionsToMerge) {
    if (item.subRecords.powerRecords) rawPower.push(...item.subRecords.powerRecords);
    if (item.subRecords.cyclingPedalingCadenceRecords)
      rawCyclingCadence.push(...item.subRecords.cyclingPedalingCadenceRecords);
    if (item.subRecords.stepsRecords && category !== ActivityCategory.STATIONARY_NON_DISTANCE)
      rawSteps.push(...item.subRecords.stepsRecords);
    if (item.subRecords.stepsCadenceRecords) rawStepsCadence.push(...item.subRecords.stepsCadenceRecords);
    if (item.subRecords.floorsClimbedRecords) rawFloorsClimbed.push(...item.subRecords.floorsClimbedRecords);
    if (item.subRecords.wheelchairPushesRecords) rawWheelchairPushes.push(...item.subRecords.wheelchairPushesRecords);
    if (item.subRecords.vo2MaxRecords) rawVo2Max.push(...item.subRecords.vo2MaxRecords);
    if (item.subRecords.heartRateVariabilityRecords) rawHrv.push(...item.subRecords.heartRateVariabilityRecords);
    if (item.subRecords.restingHeartRateRecords) rawRestingHeartRate.push(...item.subRecords.restingHeartRateRecords);
  }

  // Deduplicate records & strip metadata
  const heartRateToInsert = deduplicateRecords(rawHeartRate);
  const distanceToInsert = deduplicateRecords(rawDistance);
  const speedToInsert = deduplicateRecords(rawSpeed);
  const totalCaloriesToInsert = deduplicateRecords(rawTotalCalories);
  const activeCaloriesToInsert = deduplicateRecords(rawActiveCalories);
  const stepsToInsert = deduplicateRecords(rawSteps);
  const stepsCadenceToInsert = deduplicateRecords(rawStepsCadence);
  const elevationGainedToInsert = deduplicateRecords(rawElevationGained);
  const floorsClimbedToInsert = deduplicateRecords(rawFloorsClimbed);
  const powerToInsert = deduplicateRecords(rawPower);
  const cyclingPedalingCadenceToInsert = deduplicateRecords(rawCyclingCadence);
  const wheelchairPushesToInsert = deduplicateRecords(rawWheelchairPushes);
  const vo2MaxToInsert = deduplicateRecords(rawVo2Max);
  const heartRateVariabilityToInsert = deduplicateRecords(rawHrv);
  const restingHeartRateToInsert = deduplicateRecords(rawRestingHeartRate);

  // Calculate Numerical Summary Values
  const distanceMeters = extractDistanceMeters(rawDistance);
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const avgHeartRateBpm = extractAvgHeartRateBpm(rawHeartRate);
  const caloriesKcal = Math.round(extractCaloriesKcal(rawTotalCalories, rawActiveCalories));

  // Build Contributing Sources Metadata
  const contributingSources: ContributingSource[] = [];
  const calorieAppName = formatAppOrigin(masterCalorieSession.session.metadata?.dataOrigin);
  const hrAppName = formatAppOrigin(masterHRSession.session.metadata?.dataOrigin);

  if (category === ActivityCategory.INDOOR_MACHINE && masterDistanceSession) {
    const distAppName = formatAppOrigin(masterDistanceSession.session.metadata?.dataOrigin);
    contributingSources.push({ metric: 'Distance', source: distAppName });

    if (calorieAppName === hrAppName) {
      contributingSources.push({ metric: 'Heart Rate & Calories', source: calorieAppName });
    } else {
      contributingSources.push({ metric: 'Calories', source: calorieAppName });
      contributingSources.push({ metric: 'Heart Rate', source: hrAppName });
    }
  } else if (category === ActivityCategory.OUTDOOR_SPATIAL) {
    const distAppName = masterDistanceSession
      ? formatAppOrigin(masterDistanceSession.session.metadata?.dataOrigin)
      : calorieAppName;
    if (distAppName === calorieAppName && calorieAppName === hrAppName) {
      contributingSources.push({ metric: 'Distance, HR & Calories', source: distAppName });
    } else {
      contributingSources.push({ metric: 'Distance', source: distAppName });
      if (calorieAppName === hrAppName) {
        contributingSources.push({ metric: 'Heart Rate & Calories', source: calorieAppName });
      } else {
        contributingSources.push({ metric: 'Calories', source: calorieAppName });
        contributingSources.push({ metric: 'Heart Rate', source: hrAppName });
      }
    }
  } else {
    // STATIONARY_NON_DISTANCE
    if (calorieAppName === hrAppName) {
      contributingSources.push({ metric: 'Heart Rate & Calories', source: calorieAppName });
    } else {
      contributingSources.push({ metric: 'Calories', source: calorieAppName });
      contributingSources.push({ metric: 'Heart Rate', source: hrAppName });
    }
  }

  const mergedSummary: MergedWorkoutSession = {
    id: `merged_${Date.now()}`,
    detectedCategory: category,
    categoryLabel,
    distanceKm,
    avgHeartRateBpm,
    caloriesKcal,
    contributingSources,
  };

  // Build Master Exercise Session Record
  const startTimes = sessionsToMerge.map((s) => new Date(s.session.startTime).getTime());
  const endTimes = sessionsToMerge.map((s) => new Date(s.session.endTime).getTime());
  const earliestStartTime = new Date(Math.min(...startTimes)).toISOString();
  const latestEndTime = new Date(Math.max(...endTimes)).toISOString();
  const exerciseType = sessionsToMerge[0].session.exerciseType;

  const existingTitle = sessionsToMerge.find((s) => s.session.title?.trim())?.session.title;
  const translate = options?.t;
  const title =
    existingTitle ||
    `${translate ? translate('sessionList.mergedWorkoutDefaultTitle') : 'Merged Workout'} (${translate ? translate(`categories.${getCategoryTranslationKey(categoryLabel)}`) : formatCategoryLabel(categoryLabel)})`;

  const notes = sessionsToMerge
    .map((s) => s.session.notes)
    .filter((n): n is string => Boolean(n && n.trim()))
    .join(' | ');

  const sessionToInsert = {
    recordType: 'ExerciseSession' as const,
    startTime: earliestStartTime,
    endTime: latestEndTime,
    exerciseType,
    title,
    notes: notes || undefined,
  };

  const originalSessionIdsToDelete = sessionsToMerge
    .map((s) => s.session.metadata?.id)
    .filter((id): id is string => Boolean(id));

  // Collect sub-record UUIDs to delete from original sessions
  const subRecordMap: Array<{ key: keyof WorkoutSubRecords; recordType: RecordType }> = [
    { key: 'heartRateRecords', recordType: 'HeartRate' },
    { key: 'distanceRecords', recordType: 'Distance' },
    { key: 'speedRecords', recordType: 'Speed' },
    { key: 'totalCaloriesRecords', recordType: 'TotalCaloriesBurned' },
    { key: 'activeCaloriesRecords', recordType: 'ActiveCaloriesBurned' },
    { key: 'stepsRecords', recordType: 'Steps' },
    { key: 'stepsCadenceRecords', recordType: 'StepsCadence' },
    { key: 'elevationGainedRecords', recordType: 'ElevationGained' },
    { key: 'floorsClimbedRecords', recordType: 'FloorsClimbed' },
    { key: 'powerRecords', recordType: 'Power' },
    { key: 'cyclingPedalingCadenceRecords', recordType: 'CyclingPedalingCadence' },
    { key: 'wheelchairPushesRecords', recordType: 'WheelchairPushes' },
    { key: 'vo2MaxRecords', recordType: 'Vo2Max' },
    { key: 'heartRateVariabilityRecords', recordType: 'HeartRateVariabilityRmssd' },
    { key: 'restingHeartRateRecords', recordType: 'RestingHeartRate' },
  ];

  const originalSubRecordIdsToDelete: Array<{ recordType: RecordType; uuids: string[] }> = [];

  for (const { key, recordType } of subRecordMap) {
    const uuids = new Set<string>();
    for (const s of sessionsToMerge) {
      const recs = s.subRecords[key] as Array<{ metadata?: { id?: string } }> | undefined;
      if (recs) {
        for (const r of recs) {
          if (r.metadata?.id) {
            uuids.add(r.metadata.id);
          }
        }
      }
    }
    if (uuids.size > 0) {
      originalSubRecordIdsToDelete.push({ recordType, uuids: Array.from(uuids) });
    }
  }

  return {
    mergedSummary,
    sessionToInsert,
    heartRateToInsert,
    distanceToInsert,
    speedToInsert,
    totalCaloriesToInsert,
    activeCaloriesToInsert,
    stepsToInsert,
    stepsCadenceToInsert,
    elevationGainedToInsert,
    floorsClimbedToInsert,
    powerToInsert,
    cyclingPedalingCadenceToInsert,
    wheelchairPushesToInsert,
    vo2MaxToInsert,
    heartRateVariabilityToInsert,
    restingHeartRateToInsert,
    originalSessionIdsToDelete,
    originalSubRecordIdsToDelete,
  };
}

/**
 * Converts an ActivityCategoryLabel enum value to a human-readable English string.
 * Used as a fallback when no translation function (`t`) is available.
 */
function formatCategoryLabel(label: ActivityCategoryLabel): string {
  switch (label) {
    case ActivityCategoryLabel.INDOOR_TREADMILL:
      return 'Indoor Treadmill';
    case ActivityCategoryLabel.INDOOR_EQUIPMENT:
      return 'Indoor Equipment';
    case ActivityCategoryLabel.OUTDOOR_GPS_TRACK:
      return 'Outdoor GPS Track';
    case ActivityCategoryLabel.OUTDOOR_SPATIAL:
      return 'Outdoor Spatial';
    case ActivityCategoryLabel.STATIONARY_STRENGTH:
      return 'Stationary / Strength';
    case ActivityCategoryLabel.STATIONARY_ACTIVITY:
      return 'Stationary Activity';
    case ActivityCategoryLabel.CONFLICT:
      return 'Conflict';
    case ActivityCategoryLabel.MERGED_WORKOUT:
    default:
      return 'Merged Workout';
  }
}

/**
 * Maps an ActivityCategoryLabel to its corresponding i18n translation key
 * (e.g., `INDOOR_TREADMILL` -> `'indoorTreadmill'`), for use with the `t()` function.
 */
function getCategoryTranslationKey(label: ActivityCategoryLabel): string {
  switch (label) {
    case ActivityCategoryLabel.INDOOR_TREADMILL:
      return 'indoorTreadmill';
    case ActivityCategoryLabel.INDOOR_EQUIPMENT:
      return 'indoorEquipment';
    case ActivityCategoryLabel.OUTDOOR_GPS_TRACK:
      return 'outdoorGps';
    case ActivityCategoryLabel.OUTDOOR_SPATIAL:
      return 'outdoorSpatial';
    case ActivityCategoryLabel.STATIONARY_STRENGTH:
      return 'stationaryStrength';
    case ActivityCategoryLabel.STATIONARY_ACTIVITY:
      return 'stationaryActivity';
    case ActivityCategoryLabel.CONFLICT:
      return 'conflict';
    case ActivityCategoryLabel.MERGED_WORKOUT:
    default:
      return 'mergedWorkout';
  }
}

/**
 * Strips metadata and deduplicates Health Connect records by origin package and timestamp/ID key.
 */
export function deduplicateRecords<T extends { metadata?: any }>(
  records: T[]
): Omit<T, 'metadata'>[] {
  const seenKeys = new Set<string>();
  const result: Omit<T, 'metadata'>[] = [];

  for (const rec of records) {
    const origin = (rec as any).metadata?.dataOrigin || 'unknown';
    const id = (rec as any).metadata?.id;
    const timeKey =
      (rec as any).startTime && (rec as any).endTime
        ? `${(rec as any).startTime}_${(rec as any).endTime}`
        : `${(rec as any).time}`;
    const dedupKey = id ? id : `${origin}_${timeKey}`;

    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      const { metadata, ...cleanRecord } = rec;
      result.push(cleanRecord as Omit<T, 'metadata'>);
    }
  }

  return result;
}
