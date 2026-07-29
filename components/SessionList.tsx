import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Card,
  Text,
  Button,
  Chip,
  Divider,
  ActivityIndicator,
  IconButton,
  Surface,
  useTheme,
  Snackbar,
  Checkbox,
  SegmentedButtons,
} from 'react-native-paper';
import { format } from 'date-fns';
import {
  WorkoutConflictGroup,
  ActivityCategory,
  MergedWorkoutSession,
  ContributingSource,
  MergedWorkoutPayload,
} from '../types';
import { generateMergedWorkoutPayload } from '../utils/MergeAlgorithm';
import { healthConnectService } from '../services/HealthConnectService';
import {
  formatAppOrigin,
  calculateAvgHeartRate,
  calculateTotalDistance,
  calculateTotalCalories,
  formatExerciseType,
} from '../utils/FormatUtils';
import { MergeConfirmationModal } from './MergeConfirmationModal';
import { useLanguage } from '../i18n';

interface SessionListProps {
  groups: WorkoutConflictGroup[];
  loading: boolean;
  onRefresh: () => void;
  onMergeSuccess: (groupId: string) => void;
}

interface ConflictCardProps {
  group: WorkoutConflictGroup;
  isMerging: boolean;
  onMergeGroup: (group: WorkoutConflictGroup, selectedSessionIds: string[]) => void;
}

/**
 * Render category badge based on ActivityCategory enum and categoryLabel.
 */
const CategoryBadge: React.FC<{ category?: ActivityCategory; label?: string }> = ({ category, label }) => {
  const theme = useTheme();
  const { t } = useLanguage();

  let icon = 'tag';
  let backgroundColor = theme.colors.surfaceVariant;
  let textColor = theme.colors.onSurfaceVariant;

  let displayLabel = label;
  if (category === ActivityCategory.INDOOR_MACHINE) {
    icon = 'run-fast';
    backgroundColor = '#E0F2FE';
    textColor = '#0369A1';
    if (label === 'Indoor Treadmill') displayLabel = t('categories.indoorTreadmill');
    else if (!label || label === 'Indoor Equipment') displayLabel = t('categories.indoorEquipment');
  } else if (category === ActivityCategory.OUTDOOR_SPATIAL) {
    icon = 'compass';
    backgroundColor = '#DCFCE7';
    textColor = '#15803D';
    if (label === 'Outdoor GPS Track') displayLabel = t('categories.outdoorGps');
    else if (!label || label === 'Outdoor Spatial') displayLabel = t('categories.outdoorSpatial');
  } else if (category === ActivityCategory.STATIONARY_NON_DISTANCE) {
    icon = 'dumbbell';
    backgroundColor = '#FFE4E6';
    textColor = '#BE123C';
    if (label === 'Stationary / Strength') displayLabel = t('categories.stationaryStrength');
    else if (!label || label === 'Stationary Activity') displayLabel = t('categories.stationaryActivity');
  }

  if (!displayLabel || displayLabel === 'Conflict') {
    displayLabel = t('categories.conflict');
  }

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

/**
 * Renders metadata breakdown showing which device provided Distance vs. Heart Rate & Calories.
 */
const ContributingSourcesView: React.FC<{
  sources: ContributingSource[];
  mergedPreview?: MergedWorkoutSession;
}> = ({ sources, mergedPreview }) => {
  const theme = useTheme();
  const { t } = useLanguage();

  return (
    <Surface style={styles.sourcesContainer} elevation={0}>
      <Text variant="labelMedium" style={[styles.sourcesHeaderTitle, { color: theme.colors.primary }]}>
        {t('sessionList.telemetryAttribution')}
      </Text>

      {mergedPreview && (
        <View style={styles.previewMetricsRow}>
          <View style={styles.previewMetricItem}>
            <Text variant="bodySmall" style={styles.previewMetricLabel}>{t('metrics.distance')}</Text>
            <Text variant="titleMedium" style={styles.previewMetricValue}>
              {mergedPreview.distanceKm > 0 ? `${mergedPreview.distanceKm} km` : '0.00 km'}
            </Text>
          </View>
          <View style={styles.previewMetricDivider} />
          <View style={styles.previewMetricItem}>
            <Text variant="bodySmall" style={styles.previewMetricLabel}>{t('metrics.avgHeartRate')}</Text>
            <Text variant="titleMedium" style={styles.previewMetricValue}>
              {mergedPreview.avgHeartRateBpm ? `${mergedPreview.avgHeartRateBpm} bpm` : '--'}
            </Text>
          </View>
          <View style={styles.previewMetricDivider} />
          <View style={styles.previewMetricItem}>
            <Text variant="bodySmall" style={styles.previewMetricLabel}>{t('metrics.calories')}</Text>
            <Text variant="titleMedium" style={styles.previewMetricValue}>
              {mergedPreview.caloriesKcal} kcal
            </Text>
          </View>
        </View>
      )}

      <Divider style={styles.sourceDivider} />

      <Text variant="labelSmall" style={styles.sourcesSubLabel}>
        {t('sessionList.metricHierarchy')}
      </Text>
      <View style={styles.sourcesChipList}>
        {sources.map((cs, idx) => (
          <View key={idx} style={styles.sourcePill}>
            <Text variant="labelSmall" style={styles.sourceMetricName}>
              {cs.metric}:
            </Text>
            <Text variant="bodySmall" style={styles.sourceAppName}>
              {cs.source}
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
};

const ConflictCard: React.FC<ConflictCardProps> = ({ group, isMerging, onMergeGroup }) => {
  const theme = useTheme();
  const { t, dateFnsLocale } = useLanguage();

  const getSessionId = (item: WorkoutConflictGroup['sessions'][0], index: number) =>
    item.session.metadata?.id || `sess_${index}`;

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() =>
    group.sessions.map(getSessionId)
  );

  useEffect(() => {
    setSelectedSessionIds(group.sessions.map(getSessionId));
  }, [group]);

  const toggleSessionSelection = (id: string) => {
    if (selectedSessionIds.includes(id)) {
      setSelectedSessionIds(selectedSessionIds.filter((sId) => sId !== id));
    } else {
      setSelectedSessionIds([...selectedSessionIds, id]);
    }
  };

  let currentPayload: MergedWorkoutPayload | null = null;
  try {
    if (selectedSessionIds.length > 0) {
      currentPayload = generateMergedWorkoutPayload(group, selectedSessionIds);
    }
  } catch {
    currentPayload = null;
  }

  const startTimeFormatted = format(new Date(group.earliestStartTime), 'MMM d, HH:mm', { locale: dateFnsLocale });
  const endTimeFormatted = format(new Date(group.latestEndTime), 'HH:mm', { locale: dateFnsLocale });
  const selectedCount = selectedSessionIds.length;

  const category = currentPayload?.mergedSummary.detectedCategory || group.detectedCategory;
  const categoryLabel = currentPayload?.mergedSummary.categoryLabel || group.categoryLabel || 'Conflict';
  const sources = currentPayload?.mergedSummary.contributingSources || [];
  const mergedPreview = currentPayload?.mergedSummary;

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Title
        title={`${startTimeFormatted} - ${endTimeFormatted}`}
        titleStyle={styles.cardTitle}
        subtitle={t('sessionList.overlapCount', { total: group.sessions.length, selected: selectedCount })}
        right={() => (
          <View style={styles.headerBadgeContainer}>
            <CategoryBadge category={category} label={categoryLabel} />
          </View>
        )}
      />
      <Card.Content>
        {group.hasMultipleExerciseTypes && (
          <Chip compact icon="alert-decagram" style={styles.typeWarningChip}>
            {t('sessionList.mixedTypesWarning')}
          </Chip>
        )}

        {/* Contributing Sources & Merged Preview Box */}
        {sources.length > 0 && (
          <ContributingSourcesView sources={sources} mergedPreview={mergedPreview} />
        )}

        <Divider style={styles.divider} />

        <Text variant="labelMedium" style={styles.sessionsSubHeader}>
          {t('sessionList.selectSessionsHeader')}
        </Text>

        {group.sessions.map((item, index) => {
          const sessId = getSessionId(item, index);
          const isSelected = selectedSessionIds.includes(sessId);
          const sessStart = format(new Date(item.session.startTime), 'HH:mm:ss');
          const sessEnd = format(new Date(item.session.endTime), 'HH:mm:ss');
          const appName = formatAppOrigin(item.session.metadata?.dataOrigin, t);

          const hrVal = calculateAvgHeartRate(item.subRecords.heartRateRecords);
          const distVal = calculateTotalDistance(item.subRecords.distanceRecords);
          const calVal = calculateTotalCalories(
            item.subRecords.totalCaloriesRecords,
            item.subRecords.activeCaloriesRecords
          );

          return (
            <View key={sessId} style={styles.sessionItem}>
              <View style={styles.sessionRow}>
                <Checkbox.Android
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleSessionSelection(sessId)}
                />
                <View style={styles.sessionMainInfo}>
                  <View style={styles.sessionHeader}>
                    <Text variant="titleMedium" style={styles.sessionTitle}>
                      {item.session.title || t('sessionList.workoutDefaultTitle', { num: index + 1 })}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                      {sessStart} - {sessEnd}
                    </Text>
                  </View>

                  <Text variant="bodySmall" style={[styles.appSourceText, { color: theme.colors.primary }]}>
                    {t('sessionList.sourceLabel', { source: appName })}
                  </Text>

                  {item.session.notes ? (
                    <Text variant="bodyMedium" style={styles.notes}>
                      {item.session.notes}
                    </Text>
                  ) : null}

                  <View style={styles.badgeRow}>
                    <Chip compact icon="heart-pulse" style={styles.metricBadge}>
                      HR: {hrVal}
                    </Chip>
                    <Chip compact icon="map-marker-distance" style={styles.metricBadge}>
                      Dist: {distVal}
                    </Chip>
                    <Chip compact icon="fire" style={styles.metricBadge}>
                      Cal: {calVal}
                    </Chip>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </Card.Content>

      <Card.Actions style={styles.cardActions}>
        <Button
          mode="contained"
          icon="merge"
          loading={isMerging}
          disabled={isMerging || selectedCount < 1}
          onPress={() => onMergeGroup(group, selectedSessionIds)}
        >
          {selectedCount < 1
            ? t('sessionList.selectAtLeastOne')
            : t('sessionList.mergeSelected', { count: selectedCount })}
        </Button>
      </Card.Actions>
    </Card>
  );
};

interface StandaloneCardProps {
  group: WorkoutConflictGroup;
}

const StandaloneCard: React.FC<StandaloneCardProps> = ({ group }) => {
  const theme = useTheme();
  const { t, dateFnsLocale } = useLanguage();
  const sessionItem = group.sessions[0];
  if (!sessionItem) return null;

  const session = sessionItem.session;
  const subRecords = sessionItem.subRecords;

  const startTimeFormatted = format(new Date(session.startTime), 'MMM d, HH:mm', { locale: dateFnsLocale });
  const endTimeFormatted = format(new Date(session.endTime), 'HH:mm', { locale: dateFnsLocale });
  const appName = formatAppOrigin(session.metadata?.dataOrigin, t);
  const exerciseTypeName = formatExerciseType(session.exerciseType, t);

  const hrVal = calculateAvgHeartRate(subRecords.heartRateRecords);
  const distVal = calculateTotalDistance(subRecords.distanceRecords);
  const calVal = calculateTotalCalories(
    subRecords.totalCaloriesRecords,
    subRecords.activeCaloriesRecords
  );

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Title
        title={session.title || exerciseTypeName}
        titleStyle={styles.cardTitle}
        subtitle={`${startTimeFormatted} - ${endTimeFormatted}`}
        right={() => (
          <View style={styles.headerBadgeContainer}>
            <CategoryBadge category={group.detectedCategory} label={group.categoryLabel} />
          </View>
        )}
      />
      <Card.Content>
        <Text variant="bodySmall" style={[styles.appSourceText, { color: theme.colors.primary }]}>
          {t('sessionList.sourceLabel', { source: appName })} • {exerciseTypeName}
        </Text>

        {session.notes ? (
          <Text variant="bodyMedium" style={styles.notes}>
            {session.notes}
          </Text>
        ) : null}

        <View style={styles.badgeRow}>
          <Chip compact icon="heart-pulse" style={styles.metricBadge}>
            HR: {hrVal}
          </Chip>
          <Chip compact icon="map-marker-distance" style={styles.metricBadge}>
            Dist: {distVal}
          </Chip>
          <Chip compact icon="fire" style={styles.metricBadge}>
            Cal: {calVal}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );
};

export const SessionList: React.FC<SessionListProps> = ({
  groups,
  loading,
  onRefresh,
  onMergeSuccess,
}) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overlapping' | 'standalone'>('overlapping');
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // Confirmation Modal State
  const [pendingGroup, setPendingGroup] = useState<WorkoutConflictGroup | null>(null);
  const [pendingSelectedSessionIds, setPendingSelectedSessionIds] = useState<string[]>([]);
  const [pendingPayload, setPendingPayload] = useState<MergedWorkoutPayload | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const conflicts = groups.filter((g: WorkoutConflictGroup) => g.status === 'conflict_detected');
  const cleanSessions = groups.filter((g: WorkoutConflictGroup) => g.status !== 'conflict_detected');

  // Update default tab based on whether there are overlapping conflicts
  useEffect(() => {
    if (conflicts.length === 0) {
      setActiveTab('standalone');
    } else {
      setActiveTab('overlapping');
    }
  }, [groups]);

  // Triggered when user clicks "Merge X Workouts" button -> Opens Confirmation Modal
  const handleInitiateMergeGroup = (group: WorkoutConflictGroup, selectedSessionIds: string[]) => {
    try {
      const payload = generateMergedWorkoutPayload(group, selectedSessionIds);
      setPendingGroup(group);
      setPendingSelectedSessionIds(selectedSessionIds);
      setPendingPayload(payload);
      setModalVisible(true);
    } catch (error: any) {
      setSnackbarMessage(t('snackbars.mergeError', { error: error.message || 'Unknown error' }));
    }
  };

  // Triggered when user clicks "Confirm Merge" inside the Confirmation Modal (after 5s countdown)
  const handleConfirmMerge = async () => {
    if (!pendingGroup || !pendingPayload) return;

    try {
      setMergingGroupId(pendingGroup.id);
      await healthConnectService.executeMerge(pendingPayload);
      setSnackbarMessage(
        t('snackbars.mergeSuccess', { count: pendingSelectedSessionIds.length })
      );
      setModalVisible(false);
      onMergeSuccess(pendingGroup.id);
    } catch (error: any) {
      setSnackbarMessage(t('snackbars.mergeError', { error: error.message || 'Unknown error' }));
    } finally {
      setMergingGroupId(null);
      setPendingGroup(null);
      setPendingSelectedSessionIds([]);
      setPendingPayload(null);
    }
  };

  const handleDismissModal = () => {
    if (mergingGroupId) return; // Prevent dismiss while merge is actively persisting
    setModalVisible(false);
    setPendingGroup(null);
    setPendingSelectedSessionIds([]);
    setPendingPayload(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('sessionList.merging')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.statsBanner} elevation={1}>
        <View style={styles.statsRow}>
          <View>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('sessionList.conflictGroupsHeader')} 
            </Text>
            <Text
              variant="headlineMedium"
              style={{ color: conflicts.length > 0 ? theme.colors.error : theme.colors.primary }}
            >
              {conflicts.length}
            </Text>
          </View>

          <View>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('sessionList.regularGroupsHeader')} 
            </Text>
            <Text variant="headlineMedium">{cleanSessions.length}</Text>
          </View>

          <IconButton icon="refresh" mode="contained-tonal" onPress={onRefresh} />
        </View>
      </Surface>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(val: string) => setActiveTab(val as 'overlapping' | 'standalone')}
          buttons={[
            {
              value: 'overlapping',
              label: t('sessionList.buttonOverlappingTab', { count: conflicts.length }),
              icon: 'layers-triple-outline',
            },
            {
              value: 'standalone',
              label: t('sessionList.buttonStandaloneTab', { count: cleanSessions.length }),
              icon: 'check-circle-outline',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'overlapping' ? (
        conflicts.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContainer}>
            <IconButton icon="check-decagram" size={64} iconColor={theme.colors.primary} />
            <Text variant="titleLarge">{t('sessionList.emptyTitle')}</Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {t('sessionList.emptySubtitle', { days: '7' })}
            </Text>
            <Button mode="outlined" style={{ marginTop: 16 }} onPress={onRefresh}>
              {t('sessionList.rescanButton')}
            </Button>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {conflicts.map((group) => (
              <ConflictCard
                key={group.id}
                group={group}
                isMerging={mergingGroupId === group.id}
                onMergeGroup={handleInitiateMergeGroup}
              />
            ))}
          </ScrollView>
        )
      ) : cleanSessions.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <IconButton icon="package-variant" size={64} iconColor={theme.colors.outline} />
          <Text variant="titleLarge">{t('sessionList.emptyTitle')}</Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            No workout sessions were found in Health Connect.
          </Text>
          <Button mode="outlined" style={{ marginTop: 16 }} onPress={onRefresh}>
            {t('sessionList.rescanButton')}
          </Button>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {cleanSessions.map((group) => (
            <StandaloneCard key={group.id} group={group} />
          ))}
        </ScrollView>
      )}

      {/* Confirmation Modal prior to merging */}
      <MergeConfirmationModal
        visible={modalVisible}
        group={pendingGroup}
        selectedSessionIds={pendingSelectedSessionIds}
        payload={pendingPayload}
        isMerging={mergingGroupId !== null}
        onConfirm={handleConfirmMerge}
        onDismiss={handleDismissModal}
      />

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={4000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarMessage(null),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  statsBanner: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  segmentedButtons: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginBottom: 12,
    fontWeight: '600',
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  cardTitle: {
    fontWeight: '700',
  },
  headerBadgeContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  categoryBadge: {
    height: 32,
  },
  categoryBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  typeWarningChip: {
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#FFDCC3',
  },
  sourcesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sourcesHeaderTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  previewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewMetricLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  previewMetricValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  previewMetricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
  },
  sourceDivider: {
    marginVertical: 10,
  },
  sourcesSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.8,
  },
  sourcesChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceMetricName: {
    fontWeight: '700',
    marginRight: 4,
    color: '#475569',
  },
  sourceAppName: {
    fontWeight: '500',
    color: '#0F172A',
  },
  divider: {
    marginVertical: 10,
  },
  sessionsSubHeader: {
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  sessionItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sessionMainInfo: {
    flex: 1,
    marginLeft: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTitle: {
    fontWeight: '600',
    flex: 1,
  },
  appSourceText: {
    marginTop: 2,
    fontWeight: '600',
  },
  notes: {
    marginTop: 4,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  metricBadge: {
    height: 28,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});

