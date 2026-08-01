import {
  DistanceRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
  HeartRateRecord,
} from 'react-native-health-connect';

/**
 * Extracts numeric distance in meters across distance records.
 */
export function extractDistanceMeters(records: DistanceRecord[]): number {
  if (!records || records.length === 0) return 0;
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
  return totalMeters;
}

/**
 * Extracts numeric energy burned in kilocalories (kcal).
 */
export function extractCaloriesKcal(
  totalCalRecords: TotalCaloriesBurnedRecord[],
  activeCalRecords?: ActiveCaloriesBurnedRecord[]
): number {
  let totalKcal = 0;
  const recordsToUse =
    totalCalRecords && totalCalRecords.length > 0
      ? totalCalRecords
      : activeCalRecords || [];

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
  return totalKcal;
}

/**
 * Extracts average heart rate in BPM from HeartRateRecord samples.
 */
export function extractAvgHeartRateBpm(records: HeartRateRecord[]): number | null {
  if (!records || records.length === 0) return null;
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

  return count > 0 ? Math.round(totalBpm / count) : null;
}
