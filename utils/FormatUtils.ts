import {
  HeartRateRecord,
  DistanceRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
  SpeedRecord,
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
import {
  extractDistanceMeters,
  extractCaloriesKcal,
  extractAvgHeartRateBpm,
} from './MetricExtractors';
import { WorkoutSubRecords, MergedWorkoutPayload } from '../types';

/**
 * Known Android package name mappings to friendly app names.
 */
const KNOWN_APP_ORIGINS: Record<string, string> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.merit.sport': 'MERACH',
  'com.merach.fit': 'MERACH',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.strava': 'Strava',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.wahoo.fitness': 'Wahoo Fitness',
  'com.nike.plus.running': 'Nike Run Club',
  'com.zwift.zwiftgame': 'Zwift',
  'com.underarmour.fitness.record': 'MapMyRun',
  'com.polar.flow': 'Polar Flow',
  'com.suunto.suuntox': 'Suunto',
  'com.xiaomi.hm.health': 'Zepp / Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.komoot.androidapp': 'Komoot',
  'com.relive.app': 'Relive',
  'com.fitifywork-outs.fitify': 'Fitify',
};

/**
 * Converts a raw Health Connect dataOrigin package name into a human-readable app name.
 */
export function formatAppOrigin(
  dataOrigin?: string,
  t?: (key: string) => string
): string {
  if (!dataOrigin || !dataOrigin.trim()) {
    return t ? t('metrics.unknownApp') : 'Unknown App';
  }

  const trimmed = dataOrigin.trim();
  if (KNOWN_APP_ORIGINS[trimmed]) {
    return KNOWN_APP_ORIGINS[trimmed];
  }

  // Fallback: extract meaningful words from package name e.g. "com.acme.fitness" -> "Acme Fitness"
  const parts = trimmed
    .split('.')
    .filter((p) => !['com', 'org', 'net', 'android', 'app', 'apps'].includes(p.toLowerCase()));

  if (parts.length > 0) {
    return parts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return trimmed;
}

/**
 * Calculates average Heart Rate (bpm) from HeartRate records.
 * Returns formatted string like "142 bpm" or "--".
 */
export function calculateAvgHeartRate(records: HeartRateRecord[]): string {
  const avg = extractAvgHeartRateBpm(records);
  if (avg === null) return '--';
  return `${avg} bpm`;
}

/**
 * Calculates total distance (meters or kilometers) from Distance records.
 * Returns formatted string like "2.50 km" or "0.01 km" or "--".
 */
export function calculateTotalDistance(records: DistanceRecord[]): string {
  if (!records || records.length === 0) return '--';
  const totalMeters = extractDistanceMeters(records);
  return `${(totalMeters / 1000).toFixed(2)} km`;
}

/**
 * Calculates total calories burned (kcal) from TotalCaloriesBurned (or ActiveCaloriesBurned) records.
 * Returns formatted string like "320 kcal" or "--".
 */
export function calculateTotalCalories(
  totalCalRecords: TotalCaloriesBurnedRecord[],
  activeCalRecords?: ActiveCaloriesBurnedRecord[]
): string {
  const recordsToUse =
    totalCalRecords && totalCalRecords.length > 0
      ? totalCalRecords
      : activeCalRecords || [];

  if (recordsToUse.length === 0) return '--';

  const totalKcal = extractCaloriesKcal(totalCalRecords, activeCalRecords);
  if (totalKcal === 0) return '--';
  return `${Math.round(totalKcal)} kcal`;
}

/**
 * Converts a numeric Health Connect exerciseType integer to a human-readable name.
 * Optionally accepts a translation function `t`.
 */
export function formatExerciseType(
  type?: number,
  t?: (key: string, params?: Record<string, string | number>) => string
): string {
  if (type === undefined || type === null) {
    return t ? t('exerciseTypes.unknown') : 'Unknown Exercise';
  }

  const keyMap: Record<number, string> = {
    2: 'exerciseTypes.badminton',
    5: 'exerciseTypes.basketball',
    8: 'exerciseTypes.cycling',
    9: 'exerciseTypes.indoorCycling',
    11: 'exerciseTypes.boxing',
    13: 'exerciseTypes.calisthenics',
    16: 'exerciseTypes.dancing',
    25: 'exerciseTypes.elliptical',
    33: 'exerciseTypes.golf',
    36: 'exerciseTypes.hiit',
    37: 'exerciseTypes.hiking',
    42: 'exerciseTypes.martialArts',
    44: 'exerciseTypes.padel',
    46: 'exerciseTypes.pickleball',
    47: 'exerciseTypes.pilates',
    51: 'exerciseTypes.rockClimbing',
    53: 'exerciseTypes.rowing',
    54: 'exerciseTypes.rowingMachine',
    56: 'exerciseTypes.running',
    57: 'exerciseTypes.treadmillRunning',
    61: 'exerciseTypes.skiing',
    62: 'exerciseTypes.snowboarding',
    64: 'exerciseTypes.soccer',
    67: 'exerciseTypes.stairClimbing',
    68: 'exerciseTypes.stairClimbingMachine',
    69: 'exerciseTypes.stationaryBiking',
    70: 'exerciseTypes.stretch',
    72: 'exerciseTypes.swimmingOpenWater',
    73: 'exerciseTypes.swimmingPool',
    74: 'exerciseTypes.tableTennis',
    76: 'exerciseTypes.tennis',
    78: 'exerciseTypes.volleyball',
    79: 'exerciseTypes.walking',
    80: 'exerciseTypes.treadmillWalking',
    82: 'exerciseTypes.weightlifting',
    83: 'exerciseTypes.yoga',
  };

  if (t && keyMap[type]) {
    return t(keyMap[type]);
  }

  const typeMap: Record<number, string> = {
    0: 'Unknown',
    2: 'Badminton',
    4: 'Baseball',
    5: 'Basketball',
    8: 'Biking / Cycling',
    9: 'Indoor Cycling',
    11: 'Boxing',
    13: 'Calisthenics',
    14: 'Cricket',
    16: 'Dancing',
    25: 'Elliptical',
    26: 'Exercise Class',
    27: 'Fencing',
    28: 'Football (American)',
    29: 'Football (Australian)',
    31: 'Frisbee',
    32: 'Gardening',
    33: 'Golf',
    34: 'Gymnastics',
    35: 'Handball',
    36: 'HIIT',
    37: 'Hiking',
    38: 'Ice Hockey',
    39: 'Ice Skating',
    42: 'Martial Arts',
    44: 'Padel',
    46: 'Pickleball',
    47: 'Pilates',
    50: 'Racquetball',
    51: 'Rock Climbing',
    52: 'Roller Skating',
    53: 'Rowing',
    54: 'Rowing Machine',
    55: 'Rugby',
    56: 'Running',
    57: 'Treadmill Running',
    58: 'Sailing',
    59: 'Scuba Diving',
    60: 'Skating',
    61: 'Skiing',
    62: 'Snowboarding',
    63: 'Snowshoeing',
    64: 'Soccer',
    65: 'Softball',
    66: 'Squash',
    67: 'Stair Climbing',
    68: 'Stair Climbing Machine',
    69: 'Stationary Biking',
    70: 'Stretch',
    71: 'Surfing',
    72: 'Swimming (Open Water)',
    73: 'Swimming (Pool)',
    74: 'Table Tennis',
    76: 'Tennis',
    78: 'Volleyball',
    79: 'Walking',
    80: 'Treadmill Walking',
    81: 'Water Polo',
    82: 'Weightlifting',
    83: 'Yoga',
  };

  if (t) {
    return t('exerciseTypes.typeNumber', { type });
  }

  return typeMap[type] || `Exercise Type #${type}`;
}

export interface MetricDetailSummary {
  name: string;
  count: number;
  details: string;
}

/**
 * Returns a list of all sub-record metric metadata summaries for a given workout sub-records collection.
 */
export function getSubRecordSummaries(
  subRecords?: Partial<WorkoutSubRecords>,
  t?: (key: string, params?: Record<string, string | number>) => string
): MetricDetailSummary[] {
  if (!subRecords) return [];

  const summaries: MetricDetailSummary[] = [];

  const getName = (key: string, defaultName: string) => (t ? t(`metrics.${key}`) : defaultName);
  const getZero = () => (t ? t('metrics.zeroRecords') : '0 records');
  const getCountStr = (count: number) => (t ? t('metrics.recordsCount', { count }) : `${count} record(s)`);

  // Heart Rate
  const hrRecords = subRecords.heartRateRecords || [];
  if (hrRecords.length > 0) {
    let sampleCount = 0;
    let bpmSum = 0;
    let minBpm = Infinity;
    let maxBpm = -Infinity;

    for (const r of hrRecords) {
      if (r.samples) {
        for (const s of r.samples) {
          if (typeof s.beatsPerMinute === 'number') {
            sampleCount++;
            bpmSum += s.beatsPerMinute;
            if (s.beatsPerMinute < minBpm) minBpm = s.beatsPerMinute;
            if (s.beatsPerMinute > maxBpm) maxBpm = s.beatsPerMinute;
          }
        }
      }
    }
    const avg = sampleCount > 0 ? Math.round(bpmSum / sampleCount) : null;
    const detailStr = avg
      ? t
        ? t('metrics.avgBpmDetail', { avg, min: minBpm, max: maxBpm, count: sampleCount })
        : `Avg: ${avg} bpm (Range: ${minBpm}-${maxBpm} bpm, ${sampleCount} samples)`
      : getCountStr(hrRecords.length);
    summaries.push({ name: getName('heartRateRecords', 'Heart Rate Records'), count: hrRecords.length, details: detailStr });
  } else {
    summaries.push({ name: getName('heartRateRecords', 'Heart Rate Records'), count: 0, details: getZero() });
  }

  // Distance
  const distRecords = subRecords.distanceRecords || [];
  if (distRecords.length > 0) {
    const formatted = calculateTotalDistance(distRecords);
    summaries.push({ name: getName('distanceRecords', 'Distance Records'), count: distRecords.length, details: formatted });
  } else {
    summaries.push({ name: getName('distanceRecords', 'Distance Records'), count: 0, details: getZero() });
  }

  // Calories
  const totalCal = subRecords.totalCaloriesRecords || [];
  const activeCal = subRecords.activeCaloriesRecords || [];
  const totalCalCount = totalCal.length + activeCal.length;
  if (totalCalCount > 0) {
    const formatted = calculateTotalCalories(totalCal, activeCal);
    const detailStr = t
      ? t('metrics.caloriesDetail', { formatted, total: totalCal.length, active: activeCal.length })
      : `${formatted} (${totalCal.length} total, ${activeCal.length} active)`;
    summaries.push({
      name: getName('calorieRecords', 'Calorie Records'),
      count: totalCalCount,
      details: detailStr,
    });
  } else {
    summaries.push({ name: getName('calorieRecords', 'Calorie Records'), count: 0, details: getZero() });
  }

  // Speed
  const speedRecords = subRecords.speedRecords || [];
  if (speedRecords.length > 0) {
    let sampleCount = 0;
    let maxSpeedKmh = 0;
    for (const r of speedRecords) {
      if (r.samples) {
        for (const s of r.samples) {
          const speedObj = s.speed as any;
          let speedKmh = 0;
          if (typeof speedObj?.inKilometersPerHour === 'number') {
            speedKmh = speedObj.inKilometersPerHour;
          } else if (typeof speedObj?.inMetersPerSecond === 'number') {
            speedKmh = speedObj.inMetersPerSecond * 3.6;
          }
          if (speedKmh > 0) {
            sampleCount++;
            if (speedKmh > maxSpeedKmh) maxSpeedKmh = speedKmh;
          }
        }
      }
    }
    const detailStr = maxSpeedKmh > 0
      ? (t ? t('metrics.maxSpeedDetail', { speed: maxSpeedKmh.toFixed(1), count: sampleCount }) : `Max speed: ${maxSpeedKmh.toFixed(1)} km/h (${sampleCount} samples)`)
      : getCountStr(speedRecords.length);
    summaries.push({
      name: getName('speedRecords', 'Speed Records'),
      count: speedRecords.length,
      details: detailStr,
    });
  } else {
    summaries.push({ name: getName('speedRecords', 'Speed Records'), count: 0, details: getZero() });
  }

  // Steps
  const stepsRecords = subRecords.stepsRecords || [];
  if (stepsRecords.length > 0) {
    let totalSteps = 0;
    for (const r of stepsRecords) {
      if (typeof (r as any).count === 'number') {
        totalSteps += (r as any).count;
      }
    }
    const detailStr = t ? t('metrics.stepsCount', { count: totalSteps.toLocaleString() }) : `${totalSteps.toLocaleString()} steps`;
    summaries.push({ name: getName('stepsRecords', 'Steps Records'), count: stepsRecords.length, details: detailStr });
  } else {
    summaries.push({ name: getName('stepsRecords', 'Steps Records'), count: 0, details: getZero() });
  }

  // Steps Cadence
  const stepsCadenceRecords = subRecords.stepsCadenceRecords || [];
  summaries.push({
    name: getName('stepsCadenceRecords', 'Steps Cadence Records'),
    count: stepsCadenceRecords.length,
    details: stepsCadenceRecords.length > 0 ? getCountStr(stepsCadenceRecords.length) : getZero(),
  });

  // Elevation Gained
  const elevationRecords = subRecords.elevationGainedRecords || [];
  if (elevationRecords.length > 0) {
    let totalElevMeters = 0;
    for (const r of elevationRecords) {
      const elev = (r as any).elevation;
      if (typeof elev?.inMeters === 'number') {
        totalElevMeters += elev.inMeters;
      }
    }
    const detailStr = t ? t('metrics.elevationDetail', { meters: totalElevMeters.toFixed(1) }) : `${totalElevMeters.toFixed(1)} m`;
    summaries.push({ name: getName('elevationGainedRecords', 'Elevation Gained Records'), count: elevationRecords.length, details: detailStr });
  } else {
    summaries.push({ name: getName('elevationGainedRecords', 'Elevation Gained Records'), count: 0, details: getZero() });
  }

  // Floors Climbed
  const floorsRecords = subRecords.floorsClimbedRecords || [];
  if (floorsRecords.length > 0) {
    let totalFloors = 0;
    for (const r of floorsRecords) {
      if (typeof (r as any).floors === 'number') {
        totalFloors += (r as any).floors;
      }
    }
    const detailStr = t ? t('metrics.floorsCount', { count: totalFloors }) : `${totalFloors} floors`;
    summaries.push({ name: getName('floorsClimbedRecords', 'Floors Climbed Records'), count: floorsRecords.length, details: detailStr });
  } else {
    summaries.push({ name: getName('floorsClimbedRecords', 'Floors Climbed Records'), count: 0, details: getZero() });
  }

  // Power
  const powerRecords = subRecords.powerRecords || [];
  summaries.push({
    name: getName('powerRecords', 'Power Records'),
    count: powerRecords.length,
    details: powerRecords.length > 0 ? getCountStr(powerRecords.length) : getZero(),
  });

  // Cycling Cadence
  const cyclingCadenceRecords = subRecords.cyclingPedalingCadenceRecords || [];
  summaries.push({
    name: getName('cyclingCadenceRecords', 'Cycling Cadence Records'),
    count: cyclingCadenceRecords.length,
    details: cyclingCadenceRecords.length > 0 ? getCountStr(cyclingCadenceRecords.length) : getZero(),
  });

  // Wheelchair Pushes
  const wheelchairRecords = subRecords.wheelchairPushesRecords || [];
  summaries.push({
    name: getName('wheelchairPushesRecords', 'Wheelchair Pushes Records'),
    count: wheelchairRecords.length,
    details: wheelchairRecords.length > 0 ? getCountStr(wheelchairRecords.length) : getZero(),
  });

  // VO2 Max
  const vo2Records = subRecords.vo2MaxRecords || [];
  summaries.push({
    name: getName('vo2MaxRecords', 'VO2 Max Records'),
    count: vo2Records.length,
    details: vo2Records.length > 0 ? getCountStr(vo2Records.length) : getZero(),
  });

  // HRV
  const hrvRecords = subRecords.heartRateVariabilityRecords || [];
  summaries.push({
    name: getName('hrvRecords', 'HRV (RMSSD) Records'),
    count: hrvRecords.length,
    details: hrvRecords.length > 0 ? getCountStr(hrvRecords.length) : getZero(),
  });

  // Resting HR
  const restingHrRecords = subRecords.restingHeartRateRecords || [];
  summaries.push({
    name: getName('restingHrRecords', 'Resting HR Records'),
    count: restingHrRecords.length,
    details: restingHrRecords.length > 0 ? getCountStr(restingHrRecords.length) : getZero(),
  });

  return summaries;
}

/**
 * Converts a MergedWorkoutPayload sub-records arrays into a WorkoutSubRecords structure
 * compatible with getSubRecordSummaries.
 */
export function convertPayloadToSubRecords(payload?: MergedWorkoutPayload): WorkoutSubRecords {
  if (!payload) {
    return {
      heartRateRecords: [],
      distanceRecords: [],
      speedRecords: [],
      totalCaloriesRecords: [],
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
    };
  }
  return {
    heartRateRecords: (payload.heartRateToInsert || []) as HeartRateRecord[],
    distanceRecords: (payload.distanceToInsert || []) as DistanceRecord[],
    speedRecords: (payload.speedToInsert || []) as SpeedRecord[],
    totalCaloriesRecords: (payload.totalCaloriesToInsert || []) as TotalCaloriesBurnedRecord[],
    activeCaloriesRecords: (payload.activeCaloriesToInsert || []) as ActiveCaloriesBurnedRecord[],
    stepsRecords: (payload.stepsToInsert || []) as StepsRecord[],
    stepsCadenceRecords: (payload.stepsCadenceToInsert || []) as StepsCadenceRecord[],
    elevationGainedRecords: (payload.elevationGainedToInsert || []) as ElevationGainedRecord[],
    floorsClimbedRecords: (payload.floorsClimbedToInsert || []) as FloorsClimbedRecord[],
    powerRecords: (payload.powerToInsert || []) as PowerRecord[],
    cyclingPedalingCadenceRecords: (payload.cyclingPedalingCadenceToInsert || []) as CyclingPedalingCadenceRecord[],
    wheelchairPushesRecords: (payload.wheelchairPushesToInsert || []) as WheelchairPushesRecord[],
    vo2MaxRecords: (payload.vo2MaxToInsert || []) as Vo2MaxRecord[],
    heartRateVariabilityRecords: (payload.heartRateVariabilityToInsert || []) as HeartRateVariabilityRmssdRecord[],
    restingHeartRateRecords: (payload.restingHeartRateToInsert || []) as RestingHeartRateRecord[],
  };
}
