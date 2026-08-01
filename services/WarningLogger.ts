export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'warn' | 'error' | 'info';
  message: string;
  details?: string;
}

type LogListener = () => void;

class WarningLoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private nextId = 1;

  public log(level: 'warn' | 'error' | 'info', message: string, details?: any) {
    let formattedDetails: string | undefined;
    if (details !== undefined) {
      if (details instanceof Error) {
        formattedDetails = details.stack || details.message;
      } else if (typeof details === 'object') {
        try {
          formattedDetails = JSON.stringify(details);
        } catch {
          formattedDetails = String(details);
        }
      } else {
        formattedDetails = String(details);
      }
    }

    const entry: LogEntry = {
      id: `log_${Date.now()}_${this.nextId++}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      details: formattedDetails,
    };

    this.logs.unshift(entry); // newest first

    // Limit buffer to 100 entries
    if (this.logs.length > 100) {
      this.logs.pop();
    }

    this.notify();
  }

  public warn(message: string, details?: any) {
    console.warn(message, details);
    this.log('warn', message, details);
  }

  public error(message: string, details?: any) {
    console.error(message, details);
    this.log('error', message, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getLogsAsFormattedText(): string {
    if (this.logs.length === 0) {
      return 'No warning or error logs captured.';
    }
    return this.logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${
            l.details ? `\n  Details: ${l.details}` : ''
          }`
      )
      .join('\n\n');
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying log listener:', err);
      }
    });
  }
}

export const WarningLogger = new WarningLoggerService();
