import { query } from '../../config/db.js';

class SyncManager {
  constructor() {
    this.io = null;
    this.activeJobs = new Map(); // platform -> jobId
  }

  setSocketIO(ioInstance) {
    this.io = ioInstance;
  }

  broadcast(event, payload) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }

  /**
   * Log a message for a sync job in DB and broadcast via Socket.IO
   */
  async log(jobId, platform, level, message, details = null) {
    try {
      await query(
        `INSERT INTO sync_logs (sync_job_id, platform, log_level, message, details_json)
         VALUES (?, ?, ?, ?, ?)`,
        [jobId || null, platform, level, message, details ? JSON.stringify(details) : null]
      );
      this.broadcast('sync:log', {
        jobId,
        platform,
        level,
        message,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[SyncManager] Failed to record log:`, err.message);
    }
  }

  /**
   * Create a new sync job
   */
  async createJob(connectedAccountId, platform, jobType = 'manual') {
    if (this.activeJobs.has(platform)) {
      throw new Error(`A sync job is already actively running for platform: ${platform}`);
    }

    const res = await query(
      `INSERT INTO sync_jobs (connected_account_id, platform, job_type, status, progress_pct, started_at)
       VALUES (?, ?, ?, 'running', 0, CURRENT_TIMESTAMP)`,
      [connectedAccountId, platform, jobType]
    );

    const jobId = res.insertId;
    this.activeJobs.set(platform, jobId);

    // Update account status to 'syncing'
    await query(
      `UPDATE connected_accounts SET status = 'syncing' WHERE id = ?`,
      [connectedAccountId]
    );

    await this.log(jobId, platform, 'info', `Started ${jobType} synchronization job #${jobId}`);
    this.broadcast('sync:status', { platform, status: 'running', jobId, progress: 0 });

    return jobId;
  }

  /**
   * Update progress of a sync job
   */
  async updateProgress(jobId, platform, progressPct, recordsProcessed = 0, recordsFailed = 0, checkpoint = null) {
    await query(
      `UPDATE sync_jobs 
       SET progress_pct = ?, records_processed = ?, records_failed = ?, checkpoint_cursor = ?
       WHERE id = ?`,
      [Math.min(100, Math.max(0, progressPct)), recordsProcessed, recordsFailed, checkpoint, jobId]
    );

    this.broadcast('sync:progress', {
      jobId,
      platform,
      progressPct: Math.min(100, Math.max(0, progressPct)),
      recordsProcessed,
      recordsFailed
    });
  }

  /**
   * Complete a sync job successfully
   */
  async completeJob(jobId, connectedAccountId, platform, recordsProcessed = 0, checkpoint = null) {
    await query(
      `UPDATE sync_jobs 
       SET status = 'completed', progress_pct = 100, records_processed = ?, checkpoint_cursor = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [recordsProcessed, checkpoint, jobId]
    );

    await query(
      `UPDATE connected_accounts 
       SET status = 'connected', last_sync_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [connectedAccountId]
    );

    this.activeJobs.delete(platform);
    await this.log(jobId, platform, 'info', `Completed synchronization job #${jobId}. Processed ${recordsProcessed} items.`);
    this.broadcast('sync:status', { platform, status: 'completed', jobId, progress: 100 });
  }

  /**
   * Fail a sync job with error message
   */
  async failJob(jobId, connectedAccountId, platform, errorMessage) {
    await query(
      `UPDATE sync_jobs 
       SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [errorMessage, jobId]
    );

    await query(
      `UPDATE connected_accounts 
       SET status = 'error'
       WHERE id = ?`,
      [connectedAccountId]
    );

    this.activeJobs.delete(platform);
    await this.log(jobId, platform, 'error', `Sync job #${jobId} failed: ${errorMessage}`);
    this.broadcast('sync:status', { platform, status: 'failed', jobId, error: errorMessage });
  }

  /**
   * Cancel an ongoing sync job
   */
  async cancelJob(platform) {
    const jobId = this.activeJobs.get(platform);
    if (!jobId) return false;

    await query(
      `UPDATE sync_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [jobId]
    );
    await query(
      `UPDATE connected_accounts SET status = 'connected' WHERE platform = ? AND status = 'syncing'`,
      [platform]
    );

    this.activeJobs.delete(platform);
    await this.log(jobId, platform, 'warn', `Sync job #${jobId} cancelled by user.`);
    this.broadcast('sync:status', { platform, status: 'cancelled', jobId });
    return true;
  }

  /**
   * Get active sync status across all platforms
   */
  async getStatus() {
    const jobs = await query(`
      SELECT j.*, a.account_name, a.account_identifier 
      FROM sync_jobs j
      JOIN connected_accounts a ON j.connected_account_id = a.id
      WHERE j.status = 'running'
    `);
    return {
      activeJobs: Array.from(this.activeJobs.entries()).map(([platform, jobId]) => ({ platform, jobId })),
      runningDetails: jobs
    };
  }

  /**
   * Get recent sync history
   */
  async getHistory(limit = 20) {
    return await query(`
      SELECT j.*, a.account_name, a.account_identifier 
      FROM sync_jobs j
      JOIN connected_accounts a ON j.connected_account_id = a.id
      ORDER BY j.created_at DESC
      LIMIT ?
    `, [limit]);
  }

  /**
   * Recover on startup: reset stale 'running' sync jobs to 'failed' or 'cancelled'
   */
  async recoverStartup() {
    const res = await query(`
      UPDATE sync_jobs 
      SET status = 'failed', error_message = 'Interrupted due to server restart', completed_at = CURRENT_TIMESTAMP
      WHERE status = 'running'
    `);
    await query(`
      UPDATE connected_accounts 
      SET status = 'connected'
      WHERE status = 'syncing'
    `);
    if (res.affectedRows > 0) {
      console.log(`[SyncManager] Reset ${res.affectedRows} interrupted sync jobs on startup.`);
    }
  }
}

export const syncManager = new SyncManager();
export default syncManager;
