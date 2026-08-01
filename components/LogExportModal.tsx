import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Linking, Share } from 'react-native';
import {
  Portal,
  Dialog,
  Button,
  Text,
  Chip,
  useTheme,
  Divider,
} from 'react-native-paper';
import { useLanguage } from '../i18n';
import { WarningLogger, LogEntry } from '../services/WarningLogger';

interface LogExportModalProps {
  visible: boolean;
  onDismiss: () => void;
  authorEmail?: string;
}

export const LogExportModal: React.FC<LogExportModalProps> = ({
  visible,
  onDismiss,
  authorEmail,
}) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    setLogs(WarningLogger.getLogs());
    const unsubscribe = WarningLogger.subscribe(() => {
      setLogs(WarningLogger.getLogs());
    });
    return unsubscribe;
  }, []);

  const formattedText = WarningLogger.getLogsAsFormattedText();

  const handleSendEmail = () => {
    const recipient = authorEmail || '';
    const subject = encodeURIComponent('Workout Merger - System Warning Logs');
    const body = encodeURIComponent(formattedText);
    const url = `mailto:${recipient}?subject=${subject}&body=${body}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to generic share if mail client fails
          Share.share({
            title: 'System Warning Logs',
            message: formattedText,
          });
        }
      })
      .catch(() => {
        Share.share({
          title: 'System Warning Logs',
          message: formattedText,
        });
      });
  };

  const handleShareLogs = () => {
    Share.share({
      title: 'System Warning Logs',
      message: formattedText,
    });
  };

  const handleClearLogs = () => {
    WarningLogger.clearLogs();
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={styles.title}>{t('logsModal.title')}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('logsModal.subtitle')}
          </Text>

          <Divider style={styles.divider} />

          <ScrollView style={styles.scrollArea}>
            {logs.length === 0 ? (
              <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.outline }]}>
                {t('logsModal.empty')}
              </Text>
            ) : (
              logs.map((log) => (
                <View
                  key={log.id}
                  style={[
                    styles.logCard,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.logHeader}>
                    <Chip
                      compact
                      style={{
                        backgroundColor:
                          log.level === 'error'
                            ? theme.colors.errorContainer
                            : theme.colors.tertiaryContainer,
                      }}
                      textStyle={{
                        color:
                          log.level === 'error'
                            ? theme.colors.onErrorContainer
                            : theme.colors.onTertiaryContainer,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {log.level.toUpperCase()}
                    </Chip>
                    <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                      {log.timestamp.substring(11, 19)}
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={styles.logMessage}>
                    {log.message}
                  </Text>
                  {log.details ? (
                    <Text variant="bodySmall" style={[styles.logDetails, { color: theme.colors.outline }]}>
                      {log.details}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button onPress={handleClearLogs} disabled={logs.length === 0}>
            {t('logsModal.clearLogs')}
          </Button>
          <Button onPress={handleShareLogs} disabled={logs.length === 0}>
            {t('logsModal.shareLogs')}
          </Button>
          <Button
            mode="contained"
            onPress={handleSendEmail}
            disabled={logs.length === 0}
            style={{ marginLeft: 4 }}
          >
            {t('logsModal.sendEmail')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
    maxHeight: '85%',
  },
  title: {
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  subtitle: {
    marginBottom: 8,
  },
  divider: {
    marginBottom: 12,
  },
  scrollArea: {
    maxHeight: 320,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 24,
  },
  logCard: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logMessage: {
    fontWeight: '600',
  },
  logDetails: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actions: {
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
