import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, StatusBar, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  Appbar,
  Button,
  Text,
  SegmentedButtons,
  Surface,
  Portal,
  Dialog,
  RadioButton,
  Divider,
  useTheme,
  Snackbar,
} from 'react-native-paper';
import { subDays, startOfDay, endOfDay } from 'date-fns';

import MaterialIcon from '@react-native-vector-icons/material-design-icons';

import { healthConnectService } from './services/HealthConnectService';
import { groupOverlappingSessions } from './utils/MergeAlgorithm';
import { WorkoutConflictGroup, DetailedWorkoutSession } from './types';
import { SessionList } from './components/SessionList';
import { LogExportModal } from './components/LogExportModal';
import { LanguageProvider, useLanguage, PreferenceCode } from './i18n';
import { WarningLogger } from './services/WarningLogger';

export default function AppWrapper() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <PaperProvider
          theme={isDarkMode ? MD3DarkTheme : MD3LightTheme}
          settings={{
            icon: (props) => <MaterialIcon {...props} />,
          }}
        >
          <App isDarkMode={isDarkMode} onToggleDarkMode={setIsDarkMode} />
        </PaperProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

interface AppProps {
  isDarkMode: boolean;
  onToggleDarkMode: (isDark: boolean) => void;
}

function App({ isDarkMode, onToggleDarkMode }: AppProps) {
  const theme = useTheme();
  const { t, preference, setPreference, systemLanguage } = useLanguage();

  // Permissions state
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Scanning & filter states
  const [rawSessions, setRawSessions] = useState<DetailedWorkoutSession[]>([]);
  const [conflictGroups, setConflictGroups] = useState<WorkoutConflictGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Time tolerance state (in minutes)
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(5);
  const [rangeDays, setRangeDays] = useState<string>('7'); // 7 days default
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [logsModalVisible, setLogsModalVisible] = useState<boolean>(false);
  const [warningCount, setWarningCount] = useState<number>(0);

  const toleranceMinutesRef = useRef(toleranceMinutes);
  toleranceMinutesRef.current = toleranceMinutes;

  useEffect(() => {
    setWarningCount(WarningLogger.getLogs().length);
    return WarningLogger.subscribe(() => {
      setWarningCount(WarningLogger.getLogs().length);
    });
  }, []);

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
      setLoadError(null);
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
        recalculateConflicts(sessions, toleranceMinutesRef.current);
      } catch (error: any) {
        console.error('Failed to load workout sessions:', error);
        setLoadError(error.message || t('permissions.sdkError'));
      } finally {
        setLoading(false);
      }
    },
    [rangeDays, recalculateConflicts, t]
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
      setPermissionError(err.message || t('permissions.sdkError'));
      setHasPermissions(false);
    }
  }, [loadWorkoutSessions, t]);

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
      setPermissionError(err.message || t('permissions.deniedError'));
    }
  };

  // Trigger recalculation on tolerance change
  const handleToleranceChange = (newTolerance: number) => {
    setToleranceMinutes(newTolerance);
    recalculateConflicts(rawSessions, newTolerance);
  };

  // Handle merge success by updating rawSessions and recalculating conflict groups safely (N-1 fix)
  const handleMergeSuccess = (mergedGroupId: string) => {
    const targetGroup = conflictGroups.find((g) => g.id === mergedGroupId);
    if (targetGroup) {
      const targetGroupSessions = new Set(targetGroup.sessions);
      const mergedIds = new Set(
        targetGroup.sessions
          .map((s) => s.session.metadata?.id)
          .filter((id): id is string => Boolean(id))
      );
      setRawSessions((prevSessions) => {
        const updated = prevSessions.filter(
          (s) =>
            !targetGroupSessions.has(s) &&
            (!s.session.metadata?.id || !mergedIds.has(s.session.metadata.id))
        );
        recalculateConflicts(updated, toleranceMinutesRef.current);
        return updated;
      });
    } else {
      setConflictGroups((prev) => prev.filter((g) => g.id !== mergedGroupId));
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* App Bar Header */}
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface, paddingTop: 0, height: 56 }}>
        <Appbar.Content title={t('app.title')} titleStyle={styles.appTitle} />
        {hasPermissions && (
          <>
            {warningCount > 0 && (
              <Appbar.Action
                icon="alert-circle-outline"
                iconColor={theme.colors.error}
                onPress={() => setLogsModalVisible(true)}
              />
            )}
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
              {t('permissions.title')}
            </Text>
            <Text variant="bodyMedium" style={styles.permissionDesc}>
              {t('permissions.description')}
            </Text>

            {permissionError && (
              <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                {permissionError}
              </Text>
            )}

            <Button
              mode="contained"
              icon="shield-check"
              style={styles.grantButton}
              onPress={handleRequestPermissions}
            >
              {t('permissions.grantButton')}
            </Button>
          </Surface>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Range Selection Segment */}
          <Surface style={styles.filterBar} elevation={1}>
            <Text variant="labelMedium" style={styles.filterLabel}>
              {t('app.scanWindow')}
            </Text>
            <SegmentedButtons
              value={rangeDays}
              onValueChange={(val: string) => {
                setRangeDays(val);
                loadWorkoutSessions(val);
              }}
              buttons={[
                { value: '3', label: t('app.days3') },
                { value: '7', label: t('app.days7') },
                { value: '30', label: t('app.days30') },
              ]}
              style={styles.segmentedButtons}
            />
          </Surface>

          {/* Sessions & Conflicts List */}
          <SessionList
            groups={conflictGroups}
            loading={loading}
            rangeDays={rangeDays}
            onRefresh={loadWorkoutSessions}
            onMergeSuccess={handleMergeSuccess}
          />
        </View>
      )}

      {/* Load Error Snackbar */}
      <Snackbar
        visible={loadError !== null}
        onDismiss={() => setLoadError(null)}
        duration={5000}
        action={{
          label: t('app.refresh'),
          onPress: () => loadWorkoutSessions(),
        }}
      >
        {loadError}
      </Snackbar>

      {/* Log Export Modal */}
      <LogExportModal
        visible={logsModalVisible}
        onDismiss={() => setLogsModalVisible(false)}
      />

      {/* Settings / Tolerance, Language & Theme Dialog */}
      <Portal>
        <Dialog visible={settingsVisible} onDismiss={() => setSettingsVisible(false)} style={styles.dialog}>
          <Dialog.Title>{t('settings.title')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.dialogScrollContent}>
              {/* Section 1: Language Preference */}
              <Text variant="titleSmall" style={styles.settingsSectionTitle}>
                {t('settings.languageHeader')}
              </Text>
              <RadioButton.Group
                onValueChange={(val: string) => setPreference(val as PreferenceCode)}
                value={preference}
              >
                <RadioButton.Item
                  label={t('settings.systemDefault', {
                    lang: systemLanguage === 'pl' ? 'Polski' : 'English',
                  })}
                  value="system"
                />
                <RadioButton.Item label={t('settings.langEn')} value="en" />
                <RadioButton.Item label={t('settings.langPl')} value="pl" />
              </RadioButton.Group>

              <Divider style={styles.settingsDivider} />

              {/* Section 2: Theme Preference */}
              <Text variant="titleSmall" style={styles.settingsSectionTitle}>
                {t('settings.themeHeader')}
              </Text>
              <SegmentedButtons
                value={isDarkMode ? 'dark' : 'light'}
                onValueChange={(val: string) => onToggleDarkMode(val === 'dark')}
                buttons={[
                  { value: 'light', label: t('settings.themeLight') },
                  { value: 'dark', label: t('settings.themeDark') },
                ]}
                style={{ marginTop: 8 }}
              />

              <Divider style={styles.settingsDivider} />

              {/* Section 3: Time Tolerance */}
              <Text variant="titleSmall" style={styles.settingsSectionTitle}>
                {t('settings.toleranceHeader')}
              </Text>
              <RadioButton.Group
                onValueChange={(val: string) => handleToleranceChange(parseInt(val, 10))}
                value={toleranceMinutes.toString()}
              >
                <RadioButton.Item label={t('settings.tolerance1')} value="1" />
                <RadioButton.Item label={t('settings.tolerance5')} value="5" />
                <RadioButton.Item label={t('settings.tolerance10')} value="10" />
                <RadioButton.Item label={t('settings.tolerance15')} value="15" />
              </RadioButton.Group>

              <Divider style={styles.settingsDivider} />

              {/* Section 4: System Warning Logs */}
              <Button
                mode="outlined"
                icon="alert-circle-outline"
                onPress={() => {
                  setSettingsVisible(false);
                  setLogsModalVisible(true);
                }}
              >
                {t('settings.viewLogsButton', { count: warningCount })}
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSettingsVisible(false)}>{t('settings.done')}</Button>
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
    marginBottom: 12,
    textAlign: 'center',
  },
  dialog: {
    borderRadius: 20,
    maxHeight: '85%',
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    maxHeight: 400,
  },
  dialogScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  settingsSectionTitle: {
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  settingsDivider: {
    marginVertical: 12,
  },
});
