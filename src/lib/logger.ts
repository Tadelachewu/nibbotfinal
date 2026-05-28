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

/**
 * saveLogEntry is now deprecated in favor of server-side logSecurityEvent.
 * It has been disabled to prevent sensitive information from being stored in localStorage.
 */
export const saveLogEntry = (entry: Omit<LogEntry, 'timestamp'>) => {
  // Disabled for security: LocalStorage logging can expose sensitive business data.
  // Use logSecurityEvent() from @/lib/logger on the server instead.
  return;
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
