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
