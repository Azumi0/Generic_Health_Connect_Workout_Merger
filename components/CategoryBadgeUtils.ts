import { MD3Theme } from 'react-native-paper';
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
  defaultLabelKey: string;
};

const CATEGORY_BADGE_CONFIG: Partial<Record<ActivityCategory, CategoryBadgeConfig>> = {
  [ActivityCategory.INDOOR_MACHINE]: {
    icon: 'run-fast',
    defaultLabelKey: 'categories.indoorEquipment',
  },
  [ActivityCategory.OUTDOOR_SPATIAL]: {
    icon: 'compass',
    defaultLabelKey: 'categories.outdoorSpatial',
  },
  [ActivityCategory.STATIONARY_NON_DISTANCE]: {
    icon: 'dumbbell',
    defaultLabelKey: 'categories.stationaryActivity',
  },
};

export function getCategoryBadgeData(
  category: ActivityCategory | undefined,
  label: ActivityCategoryLabel | undefined,
  t: TranslationFunction,
  theme?: MD3Theme
): CategoryBadgeData {
  let icon = 'tag';
  let backgroundColor = theme ? theme.colors.surfaceVariant : '#F3F4F6';
  let textColor = theme ? theme.colors.onSurfaceVariant : '#374151';

  const categoryConfig = category ? CATEGORY_BADGE_CONFIG[category] : undefined;

  if (categoryConfig) {
    icon = categoryConfig.icon;
  }

  if (theme) {
    if (category === ActivityCategory.INDOOR_MACHINE) {
      backgroundColor = theme.colors.secondaryContainer;
      textColor = theme.colors.onSecondaryContainer;
    } else if (category === ActivityCategory.OUTDOOR_SPATIAL) {
      backgroundColor = theme.colors.tertiaryContainer;
      textColor = theme.colors.onTertiaryContainer;
    } else if (category === ActivityCategory.STATIONARY_NON_DISTANCE) {
      backgroundColor = theme.colors.primaryContainer;
      textColor = theme.colors.onPrimaryContainer;
    }
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
