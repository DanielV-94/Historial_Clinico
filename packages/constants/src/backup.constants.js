"use strict";
// Backup configuration constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACKUP_RETRY_DELAY_MS = exports.BACKUP_CRON = exports.MAX_BACKUP_RETENTION = void 0;
/** Maximum number of backup files to retain */
exports.MAX_BACKUP_RETENTION = 12;
/** Cron expression for monthly backup (2 AM on the 1st of each month) */
exports.BACKUP_CRON = '0 2 1 * *';
/** Retry delay for failed backups in milliseconds (30 minutes) */
exports.BACKUP_RETRY_DELAY_MS = 30 * 60 * 1000;
//# sourceMappingURL=backup.constants.js.map