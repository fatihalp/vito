# Monitoring existing backups

The Backups page can show an existing backup system alongside native Vito jobs. A monitor reads a status report; it does not install another backup engine, change schedules, import repository credentials or delete backups.

A global administrator connects the application server, report server, label and absolute JSON path. The report server can differ from the application server. The administrator must have update access to both servers. Using the same target server and label updates that monitor.

Reports must be root-owned regular files smaller than 64 KiB, with no group/other write permission or symlinked parent directories. Supported locations are under `/var/lib`, `/var/log`, `/var/backups` or `/srv`. Write reports atomically. For example:

```json
{
  "state": "healthy",
  "started_at": "2026-11-10T01:00:00Z",
  "finished_at": "2026-11-10T01:02:00Z",
  "snapshots": ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  "restore_test": {
    "state": "passed",
    "verified_at": "2026-11-10T01:03:00Z"
  }
}
```

`status` is accepted as an alternative to `state`; `last_success_at` takes precedence over `finished_at`. The latter is considered a success only for `healthy`, `passed` or `success`. A `finished` status additionally requires an explicit valid `last_success_at`. A single `snapshot` or a list/map of snapshot identifiers is supported. Verification also accepts `sqlite_restore` and `checked_at`. Only whitelisted status, timestamps and snapshot identifiers are exposed; arbitrary errors, credentials and other report content are not shown.

A missing/invalid/future success time cannot prove health. Successful backups older than the configured maximum age need attention, including when a stale report still says `running`. A running task needs a recent `started_at`. Recovery verification older than ten days, failed verification, or a stale running verification also needs attention. Unknown verification is not a successful recovery test. The page warns if the monitor itself has not refreshed in fifteen minutes.

Readers of the application server may view and refresh its report. Only project owners may request the exact optional backup/verification systemd services registered by the administrator. Requests are queued, re-authorized before execution and submitted asynchronously; submission does not mean the task succeeded. Configure verification services to restore into isolated temporary resources, never over production data. A monitor offers no in-place restore operation.

The scheduler refreshes reports every five minutes. Monitor removal deletes only Vito's observation record; external timers, services and repositories remain intact. Native Vito backup behavior is unchanged. Monitor configuration is encrypted and hidden from status responses. Rotate repository credentials in the external backup system; a monitor never needs them.

Attention and recovery notifications use connected global channels and channels belonging to the application server’s project. Repeated identical attention states are requested at most once per day (configurable with `core.backup_alert_reminder_hours`); healthy monitors do not send initial success messages. With no connected channel, no alert is recorded as requested. Queue submission is not proof of provider delivery: configure a notification channel and test delivery before relying on alerts.
