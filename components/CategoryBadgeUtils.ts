import { ActivityCategory, ActivityCategoryLabel } from '../types';

export interface CategoryBadgeData {
  icon: string;
  backgroundColor: string;
  textColor: string;
  displayLabel: string;
}

export type TranslationFunction = (key: string) => string;

const CATEGORY_LABEL_TRANSLATION_KEYS: Record<ActivityCategoryLabel, string> = {
  [ActivityCategoryLabel.INDOOR_TREADMILL]: 'categories.indoorTreadmill',
  [ActivityCategoryLabel.INDOOR_EQUIPMENT]: 'categories.indoorEquipment',
  [ActivityCategoryLabel.OUTDOOR_GPS_TRACK]: 'categories.outdoorGps',
  [ActivityCategoryLabel.OUTDOOR_SPATIAL]: 'categories.outdoorSpatial',
  [ActivityCategoryLabel.STATIONARY_STRENGTH]: 'categories.stationaryStrength',
  [ActivityCategoryLabel.STATIONARY_ACTIVITY]: 'categories.stationaryActivity',
  [ActivityCategoryLabel.CONFLICT]: 'categories.conflict',
  [ActivityCategoryLabel.MERGED_WORKOUT]: 'categories.mergedWorkout',
};

type CategoryBadgeConfig = {
  icon: string;
  backgroundColor: string;
  textColor: string;
  defaultLabelKey: string;
};

const CATEGORY_BADGE_CONFIG: Partial<Record<ActivityCategory, CategoryBadgeConfig>> = {
  [ActivityCategory.INDOOR_MACHINE]: {
    icon: 'run-fast',
    backgroundColor: '#E0F2FE',
    textColor: '#0369A1',
    defaultLabelKey: 'categories.indoorEquipment',
  },
  [ActivityCategory.OUTDOOR_SPATIAL]: {
    icon: 'compass',
    backgroundColor: '#DCFCE7',
    textColor: '#15803D',
    defaultLabelKey: 'categories.outdoorSpatial',
  },
  [ActivityCategory.STATIONARY_NON_DISTANCE]: {
    icon: 'dumbbell',
    backgroundColor: '#FFE4E6',
    textColor: '#BE123C',
    defaultLabelKey: 'categories.stationaryActivity',
  },
};

export function getCategoryBadgeData(
  category: ActivityCategory | undefined,
  label: ActivityCategoryLabel | undefined,
  t: TranslationFunction
): CategoryBadgeData {
  let icon = 'tag';
  let backgroundColor = '#F3F4F6';
  let textColor = '#374151';

  const categoryConfig = category ? CATEGORY_BADGE_CONFIG[category] : undefined;

  if (categoryConfig) {
    icon = categoryConfig.icon;
    backgroundColor = categoryConfig.backgroundColor;
    textColor = categoryConfig.textColor;
  }

  const labelTranslationKey = label ? CATEGORY_LABEL_TRANSLATION_KEYS[label] : undefined;
  let displayLabel = labelTranslationKey ? t(labelTranslationKey) : undefined;

  if (!displayLabel && categoryConfig) {
    displayLabel = t(categoryConfig.defaultLabelKey);
  }

  if (!displayLabel) {
    displayLabel = t('categories.conflict');
  }

  return {
    icon,
    backgroundColor,
    textColor,
    displayLabel,
  };
}
