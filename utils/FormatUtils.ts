import {
  HeartRateRecord,
  DistanceRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
} from 'react-native-health-connect';

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
  'com.suunto.sunntox': 'Suunto',
  'com.xiaomi.hm.health': 'Zepp / Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.komoot.androidapp': 'Komoot',
  'com.relive.app': 'Relive',
  'com.fitifywork-outs.fitify': 'Fitify',
};

/**
 * Converts a raw Health Connect dataOrigin package name into a human-readable app name.
 */
export function formatAppOrigin(dataOrigin?: string): string {
  if (!dataOrigin || !dataOrigin.trim()) {
    return 'Unknown App';
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
  if (!records || records.length === 0) return '--';

  let totalBpm = 0;
  let count = 0;

  for (const rec of records) {
    if (rec.samples && Array.isArray(rec.samples)) {
      for (const sample of rec.samples) {
        if (typeof sample.beatsPerMinute === 'number' && sample.beatsPerMinute > 0) {
          totalBpm += sample.beatsPerMinute;
          count++;
        }
      }
    }
  }

  if (count === 0) return '--';
  return `${Math.round(totalBpm / count)} bpm`;
}

/**
 * Calculates total distance (meters or kilometers) from Distance records.
 * Returns formatted string like "2.50 km" or "0.01 km" or "--".
 */
export function calculateTotalDistance(records: DistanceRecord[]): string {
  if (!records || records.length === 0) return '--';

  let totalMeters = 0;
  for (const rec of records) {
    if (!rec.distance) continue;
    const dist = rec.distance as any;
    if (typeof dist.inMeters === 'number') {
      totalMeters += dist.inMeters;
    } else if (typeof dist.inKilometers === 'number') {
      totalMeters += dist.inKilometers * 1000;
    } else if (typeof dist.value === 'number') {
      if (dist.unit === 'kilometers') {
        totalMeters += dist.value * 1000;
      } else if (dist.unit === 'miles') {
        totalMeters += dist.value * 1609.34;
      } else {
        totalMeters += dist.value;
      }
    }
  }

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
  let totalKcal = 0;

  const recordsToUse =
    totalCalRecords && totalCalRecords.length > 0
      ? totalCalRecords
      : activeCalRecords || [];

  if (recordsToUse.length === 0) return '--';

  for (const rec of recordsToUse) {
    if (!rec.energy) continue;
    const energy = rec.energy as any;
    if (typeof energy.inKilocalories === 'number') {
      totalKcal += energy.inKilocalories;
    } else if (typeof energy.inCalories === 'number') {
      totalKcal += energy.inCalories / 1000;
    } else if (typeof energy.value === 'number') {
      if (energy.unit === 'kilocalories' || energy.unit === 'kcal') {
        totalKcal += energy.value;
      } else if (energy.unit === 'calories') {
        totalKcal += energy.value / 1000;
      } else {
        totalKcal += energy.value;
      }
    }
  }

  if (totalKcal === 0) return '--';
  return `${Math.round(totalKcal)} kcal`;
}

/**
 * Converts a numeric Health Connect exerciseType integer to a human-readable name.
 */
export function formatExerciseType(type?: number): string {
  if (type === undefined || type === null) return 'Unknown Exercise';
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
export function getSubRecordSummaries(subRecords?: any): MetricDetailSummary[] {
  if (!subRecords) return [];

  const summaries: MetricDetailSummary[] = [];

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
      ? `Avg: ${avg} bpm (Range: ${minBpm}-${maxBpm} bpm, ${sampleCount} samples)`
      : `${hrRecords.length} record(s)`;
    summaries.push({ name: 'Heart Rate Records', count: hrRecords.length, details: detailStr });
  } else {
    summaries.push({ name: 'Heart Rate Records', count: 0, details: '0 records' });
  }

  // Distance
  const distRecords = subRecords.distanceRecords || [];
  if (distRecords.length > 0) {
    const formatted = calculateTotalDistance(distRecords);
    summaries.push({ name: 'Distance Records', count: distRecords.length, details: formatted });
  } else {
    summaries.push({ name: 'Distance Records', count: 0, details: '0 records' });
  }

  // Calories
  const totalCal = subRecords.totalCaloriesRecords || [];
  const activeCal = subRecords.activeCaloriesRecords || [];
  const totalCalCount = totalCal.length + activeCal.length;
  if (totalCalCount > 0) {
    const formatted = calculateTotalCalories(totalCal, activeCal);
    summaries.push({
      name: 'Calorie Records',
      count: totalCalCount,
      details: `${formatted} (${totalCal.length} total, ${activeCal.length} active)`,
    });
  } else {
    summaries.push({ name: 'Calorie Records', count: 0, details: '0 records' });
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
    summaries.push({
      name: 'Speed Records',
      count: speedRecords.length,
      details: maxSpeedKmh > 0 ? `Max speed: ${maxSpeedKmh.toFixed(1)} km/h (${sampleCount} samples)` : `${speedRecords.length} record(s)`,
    });
  } else {
    summaries.push({ name: 'Speed Records', count: 0, details: '0 records' });
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
    summaries.push({ name: 'Steps Records', count: stepsRecords.length, details: `${totalSteps.toLocaleString()} steps` });
  } else {
    summaries.push({ name: 'Steps Records', count: 0, details: '0 records' });
  }

  // Steps Cadence
  const stepsCadenceRecords = subRecords.stepsCadenceRecords || [];
  summaries.push({
    name: 'Steps Cadence Records',
    count: stepsCadenceRecords.length,
    details: stepsCadenceRecords.length > 0 ? `${stepsCadenceRecords.length} record(s)` : '0 records',
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
    summaries.push({ name: 'Elevation Gained Records', count: elevationRecords.length, details: `${totalElevMeters.toFixed(1)} m` });
  } else {
    summaries.push({ name: 'Elevation Gained Records', count: 0, details: '0 records' });
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
    summaries.push({ name: 'Floors Climbed Records', count: floorsRecords.length, details: `${totalFloors} floors` });
  } else {
    summaries.push({ name: 'Floors Climbed Records', count: 0, details: '0 records' });
  }

  // Power
  const powerRecords = subRecords.powerRecords || [];
  summaries.push({
    name: 'Power Records',
    count: powerRecords.length,
    details: powerRecords.length > 0 ? `${powerRecords.length} record(s)` : '0 records',
  });

  // Cycling Cadence
  const cyclingCadenceRecords = subRecords.cyclingPedalingCadenceRecords || [];
  summaries.push({
    name: 'Cycling Cadence Records',
    count: cyclingCadenceRecords.length,
    details: cyclingCadenceRecords.length > 0 ? `${cyclingCadenceRecords.length} record(s)` : '0 records',
  });

  // Wheelchair Pushes
  const wheelchairRecords = subRecords.wheelchairPushesRecords || [];
  summaries.push({
    name: 'Wheelchair Pushes Records',
    count: wheelchairRecords.length,
    details: wheelchairRecords.length > 0 ? `${wheelchairRecords.length} record(s)` : '0 records',
  });

  // VO2 Max
  const vo2Records = subRecords.vo2MaxRecords || [];
  summaries.push({
    name: 'VO2 Max Records',
    count: vo2Records.length,
    details: vo2Records.length > 0 ? `${vo2Records.length} record(s)` : '0 records',
  });

  // HRV
  const hrvRecords = subRecords.heartRateVariabilityRecords || [];
  summaries.push({
    name: 'HRV (RMSSD) Records',
    count: hrvRecords.length,
    details: hrvRecords.length > 0 ? `${hrvRecords.length} record(s)` : '0 records',
  });

  // Resting HR
  const restingHrRecords = subRecords.restingHeartRateRecords || [];
  summaries.push({
    name: 'Resting HR Records',
    count: restingHrRecords.length,
    details: restingHrRecords.length > 0 ? `${restingHrRecords.length} record(s)` : '0 records',
  });

  return summaries;
}

/**
 * Converts a MergedWorkoutPayload sub-records arrays into a WorkoutSubRecords structure
 * compatible with getSubRecordSummaries.
 */
export function convertPayloadToSubRecords(payload?: any): any {
  if (!payload) return {};
  return {
    heartRateRecords: payload.heartRateToInsert || [],
    distanceRecords: payload.distanceToInsert || [],
    speedRecords: payload.speedToInsert || [],
    totalCaloriesRecords: payload.totalCaloriesToInsert || [],
    activeCaloriesRecords: payload.activeCaloriesToInsert || [],
    stepsRecords: payload.stepsToInsert || [],
    stepsCadenceRecords: payload.stepsCadenceToInsert || [],
    elevationGainedRecords: payload.elevationGainedToInsert || [],
    floorsClimbedRecords: payload.floorsClimbedToInsert || [],
    powerRecords: payload.powerToInsert || [],
    cyclingPedalingCadenceRecords: payload.cyclingPedalingCadenceToInsert || [],
    wheelchairPushesRecords: payload.wheelchairPushesToInsert || [],
    vo2MaxRecords: payload.vo2MaxToInsert || [],
    heartRateVariabilityRecords: payload.heartRateVariabilityToInsert || [],
    restingHeartRateRecords: payload.restingHeartRateToInsert || [],
  };
}
