import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  PaperProvider,
  MD3DarkTheme,
  MD3LightTheme,
  Appbar,
  Button,
  Text,
  SegmentedButtons,
  Surface,
  Portal,
  Dialog,
  RadioButton,
  useTheme,
} from 'react-native-paper';
import { subDays, startOfDay, endOfDay } from 'date-fns';

import MaterialIcon from '@react-native-vector-icons/material-design-icons';

import { healthConnectService } from './services/HealthConnectService';
import { groupOverlappingSessions } from './utils/MergeAlgorithm';
import { WorkoutConflictGroup, DetailedWorkoutSession } from './types';
import { SessionList } from './components/SessionList';

export default function AppWrapper() {
  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={MD3LightTheme}
        settings={{
          icon: (props) => <MaterialIcon {...props} />,
        }}
      >
        <App />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

function App() {
  const theme = useTheme();

  // Permissions state
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Scanning & filter states
  const [rawSessions, setRawSessions] = useState<DetailedWorkoutSession[]>([]);
  const [conflictGroups, setConflictGroups] = useState<WorkoutConflictGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Time tolerance state (in minutes)
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(5);
  const [rangeDays, setRangeDays] = useState<string>('7'); // 7 days default
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);

  /**
   * Recalculate overlap conflict groups when tolerance or sessions change
   */
  const recalculateConflicts = useCallback(
    (sessions: DetailedWorkoutSession[], tolMins: number) => {
      const groups = groupOverlappingSessions(sessions, {
        toleranceMs: tolMins * 60 * 1000,
      });
      setConflictGroups(groups);
    },
    []
  );

  /**
   * Load workout sessions from Health Connect within selected date range
   */
  const loadWorkoutSessions = useCallback(
    async (targetRangeDays?: string) => {
      setLoading(true);
      try {
        const daysStr = typeof targetRangeDays === 'string' ? targetRangeDays : rangeDays;
        const days = parseInt(daysStr, 10) || 7;
        const now = new Date();
        const startDate = startOfDay(subDays(now, days)).toISOString();
        const endDate = endOfDay(now).toISOString();

        const sessions = await healthConnectService.fetchSessionsWithSubRecords(
          startDate,
          endDate
        );

        setRawSessions(sessions);
        recalculateConflicts(sessions, toleranceMinutes);
      } catch (error: any) {
        console.error('Failed to load workout sessions:', error);
      } finally {
        setLoading(false);
      }
    },
    [rangeDays, toleranceMinutes, recalculateConflicts]
  );

  /**
   * Check permissions and initialize Health Connect SDK on startup
   */
  const checkInitialPermissions = useCallback(async () => {
    try {
      setPermissionError(null);
      const isInitialized = await healthConnectService.initializeSDK();
      if (!isInitialized) {
        setHasPermissions(false);
        return;
      }

      const granted = await healthConnectService.checkPermissions();
      setHasPermissions(granted);

      if (granted) {
        loadWorkoutSessions();
      }
    } catch (err: any) {
      console.error('Error during initial permission check:', err);
      setPermissionError(err.message || 'Failed to communicate with Health Connect');
      setHasPermissions(false);
    }
  }, [loadWorkoutSessions]);

  useEffect(() => {
    checkInitialPermissions();
  }, [checkInitialPermissions]);

  /**
   * Prompt user for permissions
   */
  const handleRequestPermissions = async () => {
    try {
      setPermissionError(null);
      await healthConnectService.requestPermissions();
      const granted = await healthConnectService.checkPermissions();
      setHasPermissions(granted);
      if (granted) {
        loadWorkoutSessions();
      }
    } catch (err: any) {
      setPermissionError(err.message || 'Permission request was denied');
    }
  };

  // Trigger recalculation on tolerance change
  const handleToleranceChange = (newTolerance: number) => {
    setToleranceMinutes(newTolerance);
    recalculateConflicts(rawSessions, newTolerance);
  };

  // Remove merged group locally upon merge success
  const handleMergeSuccess = (mergedGroupId: string) => {
    setConflictGroups((prev: WorkoutConflictGroup[]) => prev.filter((g: WorkoutConflictGroup) => g.id !== mergedGroupId));
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* App Bar Header */}
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface, paddingTop: 0, height: 56 }}>
        <Appbar.Content title="Workout Deduplicator" titleStyle={styles.appTitle} />
        {hasPermissions && (
          <>
            <Appbar.Action icon="tune" onPress={() => setSettingsVisible(true)} />
            <Appbar.Action icon="refresh" onPress={() => loadWorkoutSessions()} />
          </>
        )}
      </Appbar.Header>

      {/* Permission Request Screen */}
      {hasPermissions === false ? (
        <View style={styles.permissionContainer}>
          <Surface style={styles.permissionCard} elevation={2}>
            <Text variant="headlineSmall" style={styles.permissionTitle}>
              Health Connect Access Required
            </Text>
            <Text variant="bodyMedium" style={styles.permissionDesc}>
              This app requires Health Connect permissions to read and write all exercise sessions
              and health metrics to detect and merge duplicate workouts without losing data.
            </Text>

            {permissionError && (
              <Text variant="bodySmall" style={styles.errorText}>
                {permissionError}
              </Text>
            )}

            <Button
              mode="contained"
              icon="shield-check"
              style={styles.grantButton}
              onPress={handleRequestPermissions}
            >
              Grant Permissions
            </Button>
          </Surface>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Range Selection Segment */}
          <Surface style={styles.filterBar} elevation={1}>
            <Text variant="labelMedium" style={styles.filterLabel}>
              Scan Window:
            </Text>
            <SegmentedButtons
              value={rangeDays}
              onValueChange={(val: string) => {
                setRangeDays(val);
                loadWorkoutSessions(val);
              }}
              buttons={[
                { value: '3', label: '3 Days' },
                { value: '7', label: '7 Days' },
                { value: '30', label: '30 Days' },
              ]}
              style={styles.segmentedButtons}
            />
          </Surface>

          {/* Sessions & Conflicts List */}
          <SessionList
            groups={conflictGroups}
            loading={loading}
            onRefresh={loadWorkoutSessions}
            onMergeSuccess={handleMergeSuccess}
          />
        </View>
      )}

      {/* Settings / Tolerance Modal Dialog */}
      <Portal>
        <Dialog visible={settingsVisible} onDismiss={() => setSettingsVisible(false)}>
          <Dialog.Title>Merge Settings</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Time Tolerance (Max Gap Between Workouts):
            </Text>

            <RadioButton.Group
              onValueChange={(val: string) => handleToleranceChange(parseInt(val, 10))}
              value={toleranceMinutes.toString()}
            >
              <RadioButton.Item label="1 Minute (Exact overlap)" value="1" />
              <RadioButton.Item label="5 Minutes (Default)" value="5" />
              <RadioButton.Item label="10 Minutes (Loose tolerance)" value="10" />
              <RadioButton.Item label="15 Minutes" value="15" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSettingsVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appTitle: {
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    marginRight: 12,
    fontWeight: '600',
  },
  segmentedButtons: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    padding: 24,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  permissionTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionDesc: {
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
  },
  grantButton: {
    marginTop: 8,
    width: '100%',
  },
  errorText: {
    color: '#B00020',
    marginBottom: 12,
    textAlign: 'center',
  },
});
