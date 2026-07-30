import { ActivityCategory, ActivityCategoryLabel } from '../../types';
import { getCategoryBadgeData } from '../CategoryBadgeUtils';

describe('CategoryBadge Utility', () => {
  const t = (key: string) => {
    const translations: Record<string, string> = {
      'categories.indoorTreadmill': 'Indoor Treadmill',
      'categories.indoorEquipment': 'Indoor Equipment',
      'categories.outdoorGps': 'Outdoor GPS',
      'categories.outdoorSpatial': 'Outdoor Spatial',
      'categories.stationaryStrength': 'Stationary Strength',
      'categories.stationaryActivity': 'Stationary Activity',
      'categories.conflict': 'Conflict',
      'categories.mergedWorkout': 'Merged Workout',
    };
    return translations[key] || key;
  };

  it('should return correct badge data for indoor treadmill', () => {
    const indoor = getCategoryBadgeData(
      ActivityCategory.INDOOR_MACHINE,
      ActivityCategoryLabel.INDOOR_TREADMILL,
      t
    );
    expect(indoor.icon).toBe('run-fast');
    expect(indoor.displayLabel).toBe('Indoor Treadmill');
  });

  it('should return correct badge data for default indoor equipment', () => {
    const indoorDefault = getCategoryBadgeData(
      ActivityCategory.INDOOR_MACHINE,
      ActivityCategoryLabel.INDOOR_EQUIPMENT,
      t
    );
    expect(indoorDefault.displayLabel).toBe('Indoor Equipment');
  });

  it('should return correct badge data for outdoor spatial / GPS track', () => {
    const outdoor = getCategoryBadgeData(
      ActivityCategory.OUTDOOR_SPATIAL,
      ActivityCategoryLabel.OUTDOOR_GPS_TRACK,
      t
    );
    expect(outdoor.icon).toBe('compass');
    expect(outdoor.displayLabel).toBe('Outdoor GPS');
  });

  it('should return correct badge data for stationary strength', () => {
    const stationary = getCategoryBadgeData(
      ActivityCategory.STATIONARY_NON_DISTANCE,
      ActivityCategoryLabel.STATIONARY_STRENGTH,
      t
    );
    expect(stationary.icon).toBe('dumbbell');
    expect(stationary.displayLabel).toBe('Stationary Strength');
  });

  it('should fallback to translation for conflict category label', () => {
    const conflict = getCategoryBadgeData(undefined, ActivityCategoryLabel.CONFLICT, t);
    expect(conflict.displayLabel).toBe('Conflict');
  });

  it('should return correct badge data for merged workout and undefined category', () => {
    const merged = getCategoryBadgeData(undefined, ActivityCategoryLabel.MERGED_WORKOUT, t);
    expect(merged.displayLabel).toBe('Merged Workout');

    const unknown = getCategoryBadgeData(undefined, undefined, t);
    expect(unknown.displayLabel).toBe('Conflict');
  });
});
