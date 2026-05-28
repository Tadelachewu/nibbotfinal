import { prisma } from './prisma';

export interface AuditLogParams {
  actor: string;
  action: string;
  target: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}

/**
 * Persists a centralized audit log entry to the database.
 * Used for tracking administrative and sensitive actions.
 */
export async function logSecurityEvent({
  actor,
  action,
  target,
  details,
  ip,
  userAgent
}: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        target,
        details: details ? JSON.stringify(details) : null,
        ip,
        userAgent
      }
    });
  } catch (error) {
    // Fail-safe: log to console if DB write fails to avoid blocking the business action
    console.error(`[AuditLog Failure] ${action} by ${actor} on ${target}:`, error);
  }
}

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
