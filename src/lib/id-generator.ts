import { ReportIdConfig, UserReport } from './types';

export function generateReportId(config: ReportIdConfig, sequence: number): string {
  const currentYear = new Date().getFullYear();
  const yearPart = config.yearEnabled ? `-${currentYear}` : '';
  const numberPart = String(sequence).padStart(config.numberLength, '0');
  
  return `${config.prefix}${yearPart}-${numberPart}`;
}

export function getNextSequence(config: ReportIdConfig, reports: UserReport[]): number {
  const currentYear = new Date().getFullYear();
  
  // If resetEveryYear is enabled, we only care about reports from the current year
  const relevantReports = config.resetEveryYear && config.yearEnabled
    ? reports.filter(r => {
        const reportDate = new Date(r.timestamp);
        return reportDate.getFullYear() === currentYear;
      })
    : reports;

  if (relevantReports.length === 0) {
    return config.startValue;
  }

  // Extract numeric parts from existing IDs to find the max
  // Format: PREFIX-YEAR-NUMBER or PREFIX-NUMBER
  const maxSequence = relevantReports.reduce((max, r) => {
    const parts = r.id.split('-');
    const lastPart = parts[parts.length - 1];
    const seq = parseInt(lastPart, 10);
    return !isNaN(seq) ? Math.max(max, seq) : max;
  }, config.startValue - 1);

  return maxSequence + 1;
}
