import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import { ActivityCategory, ActivityCategoryLabel } from '../types';
import { useLanguage } from '../i18n';
import { getCategoryBadgeData } from './CategoryBadgeUtils';

interface CategoryBadgeProps {
  category?: ActivityCategory;
  label?: ActivityCategoryLabel;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, label }) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const { icon, backgroundColor, textColor, displayLabel } = getCategoryBadgeData(
    category,
    label,
    t,
    theme
  );

  return (
    <Chip
      icon={icon}
      style={[styles.categoryBadge, { backgroundColor }]}
      textStyle={[styles.categoryBadgeText, { color: textColor }]}
      compact
    >
      {displayLabel}
    </Chip>
  );
};

const styles = StyleSheet.create({
  categoryBadge: {
    height: 32,
  },
  categoryBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
});
