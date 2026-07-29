import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
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
} from 'react-native-paper';
import { format } from 'date-fns';
import { WorkoutConflictGroup } from '../types';
import { generateMergedWorkoutPayload } from '../utils/MergeAlgorithm';
import { healthConnectService } from '../services/HealthConnectService';

interface SessionListProps {
  groups: WorkoutConflictGroup[];
  loading: boolean;
  onRefresh: () => void;
  onMergeSuccess: (groupId: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  groups,
  loading,
  onRefresh,
  onMergeSuccess,
}) => {
  const theme = useTheme();
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const conflicts = groups.filter((g: WorkoutConflictGroup) => g.status === 'conflict_detected');
  const cleanSessions = groups.filter((g: WorkoutConflictGroup) => g.status !== 'conflict_detected');

  const handleMergeGroup = async (group: WorkoutConflictGroup) => {
    try {
      setMergingGroupId(group.id);
      const payload = generateMergedWorkoutPayload(group);
      await healthConnectService.executeMerge(payload);
      setSnackbarMessage(`Successfully merged ${group.sessions.length} workouts into one!`);
      onMergeSuccess(group.id);
    } catch (error: any) {
      setSnackbarMessage(`Merge failed: ${error.message || 'Unknown error'}`);
    } finally {
      setMergingGroupId(null);
    }
  };

  const renderConflictCard = (group: WorkoutConflictGroup) => {
    const isMerging = mergingGroupId === group.id;
    const startTimeFormatted = format(new Date(group.earliestStartTime), 'MMM d, HH:mm');
    const endTimeFormatted = format(new Date(group.latestEndTime), 'HH:mm');

    return (
      <Card style={styles.card} mode="outlined" key={group.id}>
        <Card.Title
          title={`${startTimeFormatted} - ${endTimeFormatted}`}
          titleStyle={styles.cardTitle}
          subtitle={`Overlap of ${group.sessions.length} workouts`}
          right={(props: any) => (
            <Chip icon="alert-circle" style={styles.conflictChip} textStyle={{ color: theme.colors.onErrorContainer }}>
              Conflict
            </Chip>
          )}
        />
        <Card.Content>
          {group.hasMultipleExerciseTypes && (
            <Chip compact icon="help-circle" style={styles.typeWarningChip}>
              Mixed Exercise Types Detected
            </Chip>
          )}

          <Divider style={styles.divider} />

          {group.sessions.map((item, index) => {
            const sessStart = format(new Date(item.session.startTime), 'HH:mm:ss');
            const sessEnd = format(new Date(item.session.endTime), 'HH:mm:ss');
            const hrCount = item.subRecords.heartRateRecords.length;
            const distCount = item.subRecords.distanceRecords.length;
            const calCount = item.subRecords.totalCaloriesRecords.length;

            return (
              <View key={item.session.metadata?.id || index} style={styles.sessionItem}>
                <View style={styles.sessionHeader}>
                  <Text variant="titleMedium" style={styles.sessionTitle}>
                    {item.session.title || `Workout #${index + 1}`}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {sessStart} - {sessEnd}
                  </Text>
                </View>

                {item.session.notes ? (
                  <Text variant="bodyMedium" style={styles.notes}>
                    {item.session.notes}
                  </Text>
                ) : null}

                <View style={styles.badgeRow}>
                  <Chip compact icon="heart-pulse" style={styles.metricBadge}>
                    HR: {hrCount}
                  </Chip>
                  <Chip compact icon="map-marker-distance" style={styles.metricBadge}>
                    Dist: {distCount}
                  </Chip>
                  <Chip compact icon="fire" style={styles.metricBadge}>
                    Cal: {calCount}
                  </Chip>
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
            disabled={isMerging}
            onPress={() => handleMergeGroup(group)}
          >
            Merge {group.sessions.length} Workouts
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Scanning Health Connect for overlapping workouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.statsBanner} elevation={1}>
        <View style={styles.statsRow}>
          <View>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Detected Conflicts
            </Text>
            <Text variant="headlineMedium" style={{ color: conflicts.length > 0 ? theme.colors.error : theme.colors.primary }}>
              {conflicts.length}
            </Text>
          </View>

          <View>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Standalone Workouts
            </Text>
            <Text variant="headlineMedium">{cleanSessions.length}</Text>
          </View>

          <IconButton icon="refresh" mode="contained-tonal" onPress={onRefresh} />
        </View>
      </Surface>

      {conflicts.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <IconButton icon="check-decagram" size={64} iconColor={theme.colors.primary} />
          <Text variant="titleLarge">No Overlapping Conflicts Found</Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            All workout sessions in the selected range are distinct without time conflicts.
          </Text>
          <Button mode="outlined" style={{ marginTop: 16 }} onPress={onRefresh}>
            Re-scan Workouts
          </Button>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text variant="titleMedium" style={styles.sectionHeader}>
            Overlapping Workouts ({conflicts.length})
          </Text>
          {conflicts.map(renderConflictCard)}
        </ScrollView>
      )}

      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
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
  conflictChip: {
    marginRight: 16,
    backgroundColor: '#FFDAD6',
  },
  typeWarningChip: {
    marginBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFDCC3',
  },
  divider: {
    marginVertical: 10,
  },
  sessionItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTitle: {
    fontWeight: '600',
  },
  notes: {
    marginTop: 4,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
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
