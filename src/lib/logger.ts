export interface LogEntry {
  timestamp: string; // UTC
  sessionId: string;
  userMessage: string;
  botResponse: string;
  status: 'success' | 'failed' | 'error';
  endpoint?: string;
  responseTime?: number; // ms
  errorDetails?: string;
  tags?: string[];
}

const LOGS_STORAGE_KEY = 'nib_interaction_logs';

export const saveLogEntry = (entry: Omit<LogEntry, 'timestamp'>) => {
  if (typeof window === 'undefined') return;

  const fullEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Mask sensitive information
  const maskedEntry = maskSensitiveInfo(fullEntry);

  try {
    const existingLogsRaw = localStorage.getItem(LOGS_STORAGE_KEY);
    const existingLogs: LogEntry[] = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
    
    // Keep all logs for now as per user request (transitioning to database soon)
    const updatedLogs = [maskedEntry, ...existingLogs];
    
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
  } catch (error) {
    console.error('Failed to save log entry:', error);
  }
};

export const getLogs = (): LogEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const logsRaw = localStorage.getItem(LOGS_STORAGE_KEY);
    return logsRaw ? JSON.parse(logsRaw) : [];
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
};

const maskSensitiveInfo = (entry: LogEntry): LogEntry => {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin', 'cvv'];
  let maskedMessage = entry.userMessage;
  let maskedResponse = entry.botResponse;

  sensitiveKeys.forEach(key => {
    // Basic regex to find patterns like "password: value" or similar in strings
    const regex = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,]+)`, 'gi');
    maskedMessage = maskedMessage.replace(regex, '$1********');
    maskedResponse = maskedResponse.replace(regex, '$1********');
  });

  return {
    ...entry,
    userMessage: maskedMessage,
    botResponse: maskedResponse,
  };
};
