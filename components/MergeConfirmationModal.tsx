import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Portal,
  Dialog,
  Text,
  Button,
  Divider,
  Chip,
  Surface,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { format } from 'date-fns';
import { WorkoutConflictGroup, MergedWorkoutPayload, DetailedWorkoutSession, ActivityCategoryLabel } from '../types';
import {
  formatAppOrigin,
  formatExerciseType,
  getSubRecordSummaries,
  convertPayloadToSubRecords,
} from '../utils/FormatUtils';
import { CategoryBadge } from './CategoryBadge';
import { useLanguage } from '../i18n';

interface MergeConfirmationModalProps {
  visible: boolean;
  group: WorkoutConflictGroup | null;
  selectedSessionIds: string[];
  payload: MergedWorkoutPayload | null;
  isMerging: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const MergeConfirmationModal: React.FC<MergeConfirmationModalProps> = ({
  visible,
  group,
  selectedSessionIds,
  payload,
  isMerging,
  onConfirm,
  onDismiss,
}) => {
  const theme = useTheme();
  const { t, dateFnsLocale } = useLanguage();

  const [countdown, setCountdown] = useState<number>(5);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // 5-second countdown timer whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      setCountdown(5);
      setShowDetails(false);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [visible]);

  if (!group || !visible) return null;

  // Filter only the selected workout sessions being merged
  const selectedSessions: DetailedWorkoutSession[] = group.sessions.filter((s, idx) => {
    const id = s.session.metadata?.id || `sess_${idx}`;
    return selectedSessionIds.includes(id);
  });

  const categoryLabel =
    payload?.mergedSummary.categoryLabel || group.categoryLabel || ActivityCategoryLabel.MERGED_WORKOUT;
  const startDateFormatted = format(new Date(group.earliestStartTime), 'MMM d', {
    locale: dateFnsLocale,
  });
  const startTimeFormatted = format(new Date(group.earliestStartTime), 'HH:mm:ss', {
    locale: dateFnsLocale,
  });
  const endDateFormatted = format(new Date(group.latestEndTime), 'MMM d', {
    locale: dateFnsLocale,
  });
  const endTimeFormatted = format(new Date(group.latestEndTime), 'HH:mm:ss', {
    locale: dateFnsLocale,
  });

  const mergedSummary = payload?.mergedSummary;
  const mergedSubSummaries = payload
    ? getSubRecordSummaries(convertPayloadToSubRecords(payload), t)
    : [];

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={[styles.dialogTitle, { color: theme.colors.error }]}>
          {t('confirmationModal.title')}
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Irreversible Warning Box */}
            <Surface style={styles.warningBox} elevation={0}>
              <View style={styles.warningHeader}>
                <IconButton icon="alert" iconColor="#DC2626" size={24} style={styles.warningIcon} />
                <Text variant="titleMedium" style={styles.warningTitle}>
                  {t('confirmationModal.warningTitle')}
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.warningText}>
                {t('confirmationModal.warningText', { count: selectedSessions.length })}
              </Text>
            </Surface>

            {/* High Level Summary Card */}
            <Surface style={styles.summaryCard} elevation={1}>
              <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                {t('confirmationModal.summaryTitle')}
              </Text>

              <View style={styles.summaryRow}>
                <CategoryBadge category={group.detectedCategory} label={categoryLabel} />
                <Text variant="bodyMedium" style={styles.timeText}>
                  {startDateFormatted}{'\n'}{startTimeFormatted}
                </Text>
                <Text variant="bodyMedium" style={styles.timeText}>
                   - 
                </Text>
                <Text variant="bodyMedium" style={styles.timeText}>
                  {endDateFormatted}{'\n'}{endTimeFormatted}
                </Text>
              </View>

              {mergedSummary && (
                <View style={styles.previewMetricsRow}>
                  <View style={styles.previewMetricItem}>
                    <Text variant="labelSmall" style={styles.metricLabel}>{t('metrics.distance')}</Text>
                    <Text variant="titleMedium" style={styles.metricValue}>
                      {mergedSummary.distanceKm > 0 ? `${mergedSummary.distanceKm} km` : '0.00 km'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.previewMetricItem}>
                    <Text variant="labelSmall" style={styles.metricLabel}>{t('metrics.avgHrShort')}</Text>
                    <Text variant="titleMedium" style={styles.metricValue}>
                      {mergedSummary.avgHeartRateBpm ? `${mergedSummary.avgHeartRateBpm} bpm` : '--'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.previewMetricItem}>
                    <Text variant="labelSmall" style={styles.metricLabel}>{t('metrics.calories')}</Text>
                    <Text variant="titleMedium" style={styles.metricValue}>
                      {mergedSummary.caloriesKcal} kcal
                    </Text>
                  </View>
                </View>
              )}
            </Surface>

            {/* Full Details Toggle Button */}
            <Button
              mode="outlined"
              icon={showDetails ? 'chevron-up' : 'chevron-down'}
              onPress={() => setShowDetails(!showDetails)}
              style={styles.detailsToggleButton}
            >
              {showDetails
                ? t('confirmationModal.hideDetails')
                : t('confirmationModal.showDetails', { count: selectedSessions.length })}
            </Button>

            {/* Expanded Workout List & All Metadata */}
            {showDetails && (
              <View style={styles.detailsContainer}>
                <Divider style={styles.detailsDivider} />

                {/* SECTION 1: FINAL MERGED OUTPUT METADATA */}
                {payload && (
                  <Surface style={styles.mergedOutputDetailCard} elevation={2}>
                    <View style={styles.workoutDetailHeader}>
                      <Text variant="titleMedium" style={[styles.workoutTitle, { color: '#0369A1' }]}>
                        {t('confirmationModal.masterTitle')}
                      </Text>
                      <Chip compact icon="check-decagram" style={styles.outputChip}>
                        {t('confirmationModal.finalOutputChip')}
                      </Chip>
                    </View>

                    <View style={styles.metadataGrid}>
                      <Text variant="bodySmall" style={styles.metaRow}>
                        <Text style={styles.metaLabel}>{t('confirmationModal.sessionTitleLabel')} </Text>
                        {payload.sessionToInsert.title || t('confirmationModal.mergedWorkoutDefaultTitle')}
                      </Text>

                      <Text variant="bodySmall" style={styles.metaRow}>
                        <Text style={styles.metaLabel}>{t('confirmationModal.exerciseTypeLabel')} </Text>
                        {formatExerciseType(payload.sessionToInsert.exerciseType, t)} (ID: {payload.sessionToInsert.exerciseType})
                      </Text>

                      <Text variant="bodySmall" style={styles.metaRow}>
                        <Text style={styles.metaLabel}>{t('confirmationModal.targetTimeLabel')} </Text>
                        {format(new Date(payload.sessionToInsert.startTime), 'HH:mm:ss')} -{' '}
                        {format(new Date(payload.sessionToInsert.endTime), 'HH:mm:ss')}
                      </Text>

                      <Text variant="bodySmall" style={styles.metaRow}>
                        <Text style={styles.metaLabel}>{t('confirmationModal.categoryLabel')} </Text>
                        {categoryLabel}
                      </Text>

                      {mergedSummary?.contributingSources && mergedSummary.contributingSources.length > 0 ? (
                        <View style={{ marginTop: 4 }}>
                          <Text style={styles.metaLabel}>{t('confirmationModal.metricSourceLabel')} </Text>
                          {mergedSummary.contributingSources.map((cs, cIdx) => (
                            <Text key={cIdx} variant="bodySmall" style={{ marginLeft: 8, color: theme.colors.primary }}>
                              • {cs.metric}: {cs.source}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    <Divider style={styles.subDivider} />

                    <Text variant="labelSmall" style={styles.subHeaderTitle}>
                      {t('confirmationModal.recordsToInsertHeader', { count: mergedSubSummaries.filter((s) => s.count > 0).length })}
                    </Text>

                    <View style={styles.subRecordList}>
                      {mergedSubSummaries.map((sub, sIdx) => (
                        <View key={sIdx} style={styles.subRecordRow}>
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.subRecordName,
                              { color: sub.count > 0 ? '#0369A1' : theme.colors.outline },
                            ]}
                          >
                            • {sub.name}:
                          </Text>
                          <Text variant="bodySmall" style={styles.subRecordValue}>
                            {sub.details}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Surface>
                )}

                {/* SECTION 2: ORIGINAL INPUT WORKOUTS */}
                <Text variant="titleMedium" style={styles.detailsHeader}>
                  {t('confirmationModal.originalWorkoutsHeader', { count: selectedSessions.length })}
                </Text>

                {selectedSessions.map((item, idx) => {
                  const sess = item.session;
                  const appName = formatAppOrigin(sess.metadata?.dataOrigin, t);
                  const exTypeName = formatExerciseType(sess.exerciseType, t);
                  const sessStart = format(new Date(sess.startTime), 'HH:mm:ss');
                  const sessEnd = format(new Date(sess.endTime), 'HH:mm:ss');
                  const subSummaries = getSubRecordSummaries(item.subRecords, t);

                  return (
                    <Surface key={idx} style={styles.workoutDetailCard} elevation={1}>
                      <View style={styles.workoutDetailHeader}>
                        <Text variant="titleSmall" style={styles.workoutTitle}>
                          #{idx + 1}: {sess.title || `Exercise Session (${exTypeName})`}
                        </Text>
                        <Chip compact icon="application" style={styles.appChip}>
                          {appName}
                        </Chip>
                      </View>

                      <View style={styles.metadataGrid}>
                        <Text variant="bodySmall" style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Time Window: </Text>
                          {sessStart} - {sessEnd}
                        </Text>

                        <Text variant="bodySmall" style={styles.metaRow}>
                          <Text style={styles.metaLabel}>{t('confirmationModal.exerciseTypeLabel')} </Text>
                          {exTypeName} (ID: {sess.exerciseType})
                        </Text>

                        <Text variant="bodySmall" style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Package Origin: </Text>
                          {sess.metadata?.dataOrigin || 'Unknown'}
                        </Text>

                        <Text variant="bodySmall" style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Session UUID: </Text>
                          {sess.metadata?.id || 'N/A'}
                        </Text>

                        {sess.metadata?.clientRecordId ? (
                          <Text variant="bodySmall" style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Client Record ID: </Text>
                            {sess.metadata.clientRecordId}
                          </Text>
                        ) : null}

                        {sess.metadata?.lastModifiedTime ? (
                          <Text variant="bodySmall" style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Last Modified: </Text>
                            {format(new Date(sess.metadata.lastModifiedTime), 'yyyy-MM-dd HH:mm:ss')}
                          </Text>
                        ) : null}

                        {sess.notes ? (
                          <Text variant="bodySmall" style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Notes: </Text>
                            {sess.notes}
                          </Text>
                        ) : null}
                      </View>

                      <Divider style={styles.subDivider} />

                      <Text variant="labelSmall" style={styles.subHeaderTitle}>
                        {t('confirmationModal.recordedTelemetryHeader')}
                      </Text>

                      <View style={styles.subRecordList}>
                        {subSummaries.map((sub, sIdx) => (
                          <View key={sIdx} style={styles.subRecordRow}>
                            <Text
                              variant="bodySmall"
                              style={[
                                styles.subRecordName,
                                { color: sub.count > 0 ? theme.colors.primary : theme.colors.outline },
                              ]}
                            >
                              • {sub.name}:
                            </Text>
                            <Text variant="bodySmall" style={styles.subRecordValue}>
                              {sub.details}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Surface>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={styles.dialogActions}>
          <Button mode="outlined" onPress={onDismiss} disabled={isMerging}>
            {t('confirmationModal.cancel')}
          </Button>

          <Button
            mode="contained"
            icon="merge"
            loading={isMerging}
            disabled={countdown > 0 || isMerging}
            onPress={onConfirm}
            buttonColor={countdown > 0 ? theme.colors.surfaceDisabled : theme.colors.error}
            textColor={countdown > 0 ? theme.colors.onSurfaceDisabled : theme.colors.onError}
          >
            {countdown > 0
              ? t('confirmationModal.confirmTimer', { countdown })
              : t('confirmationModal.confirmReady')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '90%',
    borderRadius: 20,
  },
  dialogTitle: {
    fontWeight: '700',
    fontSize: 20,
    paddingBottom: 4,
  },
  scrollArea: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warningIcon: {
    margin: 0,
    marginRight: 4,
  },
  warningTitle: {
    fontWeight: '700',
    color: '#991B1B',
    textAlign: 'center',
  },
  warningText: {
    color: '#7F1D1D',
    lineHeight: 20,
    textAlign: 'justify',
  },
  boldText: {
    fontWeight: '700',
  },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeText: {
    fontWeight: '600',
    opacity: 0.8,
    textAlign: 'center',
  },
  previewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    opacity: 0.6,
  },
  metricValue: {
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  detailsToggleButton: {
    marginVertical: 4,
  },
  detailsContainer: {
    marginTop: 12,
  },
  detailsDivider: {
    marginBottom: 12,
  },
  detailsHeader: {
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  mergedOutputDetailCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
  },
  outputChip: {
    backgroundColor: '#0284C7',
  },
  workoutDetailCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  workoutDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  appChip: {
    height: 28,
  },
  metadataGrid: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  metaRow: {
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  metaLabel: {
    fontWeight: '700',
    opacity: 0.7,
  },
  subDivider: {
    marginVertical: 8,
  },
  subHeaderTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  subRecordList: {
    paddingLeft: 4,
  },
  subRecordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    width: '100%',
  },
  subRecordName: {
    fontWeight: '600',
    marginRight: 8,
    flexShrink: 0,
  },
  subRecordValue: {
    opacity: 0.8,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  dialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    justifyContent: 'flex-end',
    gap: 8,
  },
});
