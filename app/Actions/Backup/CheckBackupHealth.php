<?php

namespace App\Actions\Backup;

use App\Enums\BackupFileStatus;
use App\Enums\BackupStatus;
use App\Enums\BackupType;
use App\Facades\Notifier;
use App\Models\Backup;
use App\Notifications\BackupNeedsAttention;
use App\Notifications\BackupRecovered;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Keeps backups.health in sync with what is wrong with a backup and alerts when a problem starts,
 * every few hours while it lasts, and once it clears.
 */
class CheckBackupHealth
{
    /**
     * Runs inside backup jobs, so errors are reported instead of thrown: a failed alert must never fail a backup.
     * Alerts are sent before the state is saved, so an alert that could not be sent is sent by the next check.
     */
    public function check(Backup $backup): void
    {
        rescue(function () use ($backup): void {
            $backup = $backup->fresh();

            if ($backup === null || in_array($backup->status, [BackupStatus::INSTALLING, BackupStatus::DELETING], true)) {
                return;
            }

            $problems = $backup->enabled ? $this->problems($backup) : [];
            $health = $backup->health;

            if ($problems === []) {
                if ($health !== null && $backup->enabled) {
                    Notifier::send($backup->server, new BackupRecovered($backup));
                }

                if ($health !== null) {
                    $backup->update(['health' => null]);
                }

                return;
            }

            $notify = array_diff_key($problems, $health['problems'] ?? []) !== []
                || Carbon::parse($health['notified_at'])->addHours((int) config('core.backup_alert_reminder_hours'))->isPast();

            if ($notify) {
                Notifier::send($backup->server, new BackupNeedsAttention($backup, $problems));
            }

            $backup->update(['health' => [
                'problems' => $problems,
                'since' => $health['since'] ?? now()->toIso8601String(),
                'notified_at' => $notify ? now()->toIso8601String() : $health['notified_at'],
            ]]);
        });
    }

    /**
     * @return array<string, string>
     */
    public function problems(Backup $backup): array
    {
        if ($backup->status === BackupStatus::FAILED) {
            return ['setup' => __('Setting up this backup failed, so it is not running. Check the server logs, then save the backup again to retry.')];
        }

        if ($backup->status !== null) {
            return [];
        }

        $problems = [];
        $configuration = $backup->configuration ?? [];
        $finished = $backup->files()->where('status', '!=', BackupFileStatus::CREATING)->latest('id')->first();
        $succeeded = $backup->files()->whereNotIn('status', [BackupFileStatus::CREATING, BackupFileStatus::FAILED])->latest('id')->value('created_at');
        $schedules = $backup->type === BackupType::PGBACKREST ? array_filter($configuration['schedules'] ?? []) : [$backup->interval];

        if ($finished?->status === BackupFileStatus::FAILED) {
            $problems['failed'] = __('The last backup failed: :error', ['error' => Str::limit((string) $finished->message, 300)]);
        } elseif (($expected = $this->missed($backup, $schedules, $succeeded)) !== null && $backup->files()->where('status', BackupFileStatus::CREATING)->doesntExist()) {
            $problems['overdue'] = __('No backup has run since :since. The one due at :expected did not start.', [
                'since' => $succeeded?->format('Y-m-d H:i T') ?? __('it was created'),
                'expected' => $expected->format('Y-m-d H:i T'),
            ]);
        }

        if ($backup->type !== BackupType::PGBACKREST) {
            return $problems;
        }

        if ($configuration['archive_failing'] ?? false) {
            $problems['archiving'] = __('PostgreSQL is failing to archive WAL to S3, so point-in-time recovery is falling behind.');
        }

        if (isset($configuration['wal_dropped_at']) && ($succeeded === null || $succeeded->lte(Carbon::parse($configuration['wal_dropped_at'])))) {
            $problems['wal_gap'] = __('pgBackRest dropped WAL at :time because the archive queue was full, so point-in-time recovery has a gap until the next backup finishes.', [
                'time' => Carbon::parse($configuration['wal_dropped_at'])->format('Y-m-d H:i T'),
            ]);
        }

        if ($configuration['last_backup_errors'] ?? false) {
            $problems['integrity'] = __('pgBackRest found errors such as page checksum failures in the last backup, which can mean corrupted data. Run pgbackrest verify on the server and check PostgreSQL.');
        }

        if (($configuration['last_check_result'] ?? null) === 'failed') {
            $problems['check'] = __('pgbackrest check failed, so WAL may not be reaching S3: :error', ['error' => Str::limit((string) ($configuration['last_check_error'] ?? ''), 300)]);
        }

        if (($configuration['last_verify_result'] ?? null) === 'failed') {
            $problems['verify'] = __('pgbackrest verify found a problem in the backup repository: :error', ['error' => Str::limit((string) ($configuration['last_verify_error'] ?? ''), 300)]);
        }

        foreach (['check' => 'last_checked_at', 'verify' => 'last_verified_at'] as $task => $last) {
            $expected = $this->missed($backup, [$configuration[$task.'_schedule'] ?? null], isset($configuration[$last]) ? Carbon::parse($configuration[$last]) : null);

            if ($expected !== null && ! $this->pending($configuration, $task)) {
                $problems[$task.'_overdue'] = __('pgbackrest :task has not run since it was due at :expected.', ['task' => $task, 'expected' => $expected->format('Y-m-d H:i T')]);
            }
        }

        return $problems;
    }

    /**
     * @return list<array{id: int, server_id: int, title: string, problems: list<string>}>
     */
    public function attention(Relation $backups): array
    {
        return $backups->whereNotNull('backups.health')->with('server', 'database')->get()
            ->map(fn (Backup $backup): array => [
                'id' => $backup->id,
                'server_id' => $backup->server_id,
                'title' => __('Backup of :target on :server', ['target' => $backup->target() ?? '-', 'server' => $backup->server->name]),
                'problems' => array_values($backup->health['problems']),
            ])
            ->all();
    }

    /**
     * A check or verify requested within the grace period, or a verify started within the last day, is still expected to finish.
     *
     * @param  array<string, mixed>  $configuration
     */
    private function pending(array $configuration, string $task): bool
    {
        $grace = now()->subMinutes((int) config('core.backup_overdue_grace_minutes'));

        return (isset($configuration[$task.'_requested_at']) && Carbon::parse($configuration[$task.'_requested_at'])->gt($grace))
            || (isset($configuration[$task]['started_at']) && Carbon::parse($configuration[$task]['started_at'])->gt(now()->subDay()));
    }

    /**
     * The latest scheduled time, at least the grace period ago, that nothing ran after; null when nothing was missed.
     *
     * @param  array<int|string, string|null>  $schedules
     */
    private function missed(Backup $backup, array $schedules, ?Carbon $last): ?Carbon
    {
        $reference = now()->subMinutes((int) config('core.backup_overdue_grace_minutes'));
        $expected = collect($schedules)->map(fn (?string $schedule): ?Carbon => Backup::lastDue($schedule, $reference))->filter()->max();

        return $expected !== null && $backup->created_at->lt($expected) && ($last === null || $last->lt($expected)) ? $expected : null;
    }
}
