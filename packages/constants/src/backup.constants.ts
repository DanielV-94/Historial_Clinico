// Backup configuration constants

/** Maximum number of backup files to retain */
export const MAX_BACKUP_RETENTION = 12;

/** Cron expression for monthly backup (2 AM on the 1st of each month) */
export const BACKUP_CRON = '0 2 1 * *';

/** Retry delay for failed backups in milliseconds (30 minutes) */
export const BACKUP_RETRY_DELAY_MS = 30 * 60 * 1000;
