import { ActivityCategory, ActivityCategoryLabel } from '../../types';
import { getCategoryBadgeData } from '../CategoryBadgeUtils';

function runTests() {
  console.log('--- Running CategoryBadge Utility Tests ---');

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

  const indoor = getCategoryBadgeData(ActivityCategory.INDOOR_MACHINE, ActivityCategoryLabel.INDOOR_TREADMILL, t);
  console.assert(indoor.icon === 'run-fast', 'Indoor treadmill icon should be run-fast');
  console.assert(indoor.displayLabel === 'Indoor Treadmill', 'Indoor treadmill label should translate correctly');

  const indoorDefault = getCategoryBadgeData(ActivityCategory.INDOOR_MACHINE, ActivityCategoryLabel.INDOOR_EQUIPMENT, t);
  console.assert(indoorDefault.displayLabel === 'Indoor Equipment', 'Indoor equipment label should translate correctly');

  const outdoor = getCategoryBadgeData(ActivityCategory.OUTDOOR_SPATIAL, ActivityCategoryLabel.OUTDOOR_GPS_TRACK, t);
  console.assert(outdoor.icon === 'compass', 'Outdoor spatial icon should be compass');
  console.assert(outdoor.displayLabel === 'Outdoor GPS', 'Outdoor GPS label should translate correctly');

  const stationary = getCategoryBadgeData(ActivityCategory.STATIONARY_NON_DISTANCE, ActivityCategoryLabel.STATIONARY_STRENGTH, t);
  console.assert(stationary.icon === 'dumbbell', 'Stationary category icon should be dumbbell');
  console.assert(stationary.displayLabel === 'Stationary Strength', 'Stationary strength label should translate correctly');

  const conflict = getCategoryBadgeData(undefined, ActivityCategoryLabel.CONFLICT, t);
  console.assert(conflict.displayLabel === 'Conflict', 'Conflict label should fallback to translation');

  const unknown = getCategoryBadgeData(undefined, undefined, t);
  const merged = getCategoryBadgeData(undefined, ActivityCategoryLabel.MERGED_WORKOUT, t);
  console.assert(merged.displayLabel === 'Merged Workout', 'Merged workout label should translate correctly');
  console.assert(unknown.displayLabel === 'Conflict', 'Undefined category should fallback to conflict label');

  console.log('✅ ALL CATEGORY BADGE TESTS PASSED SUCCESSFULLY!');
}

runTests();
