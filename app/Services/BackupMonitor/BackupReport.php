<?php

namespace App\Services\BackupMonitor;

use Carbon\CarbonImmutable;
use Throwable;

class BackupReport
{
    private const PASSED = ['healthy', 'passed', 'success'];

    private const FAILED = ['failed', 'error'];

    public function parse(array $report, int $maxAgeHours, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $freshSince = $now->subHours($maxAgeHours);
        $state = $report['state'] ?? $report['status'] ?? null;
        $finishedAt = in_array($state, self::PASSED, true) ? ($report['finished_at'] ?? null) : null;
        $success = $this->date($report['last_success_at'] ?? $finishedAt, $now);
        $started = $this->date($report['started_at'] ?? null, $now);
        $restore = is_array($report['restore_test'] ?? null) ? $report['restore_test'] : [];
        $verified = $this->date($restore['verified_at'] ?? $restore['checked_at'] ?? null, $now);
        $restoreStarted = $this->date($restore['started_at'] ?? $restore['checked_at'] ?? null, $now);
        $verification = $this->verification(
            $restore['state'] ?? $restore['sqlite_restore'] ?? null,
            $restoreStarted,
            $verified,
            $freshSince,
            $now,
        );
        $overdue = $success?->lt($freshSince) ?? false;
        $status = match (true) {
            in_array($state, self::FAILED, true) => 'failed',
            $overdue => 'warning',
            $state === 'running' && $started?->gte($freshSince) => 'running',
            $success === null => 'unknown',
            in_array($state, [...self::PASSED, 'finished'], true) => 'healthy',
            default => 'unknown',
        };

        if ($status === 'healthy' && in_array($verification, ['failed', 'stale'], true)) {
            $status = 'warning';
        }

        return ['status' => $status, 'details' => [
            'last_success_at' => $success?->toIso8601String(),
            'restore_state' => $verification,
            'restore_verified_at' => $verified?->toIso8601String(),
            'snapshots' => $this->snapshots($report),
            'error_code' => match ($status) {
                'failed' => 'backup_failed',
                'warning' => $overdue ? 'overdue' : 'verification_attention',
                'unknown' => 'unverified',
                default => null,
            },
        ]];
    }

    private function verification(
        mixed $state,
        ?CarbonImmutable $started,
        ?CarbonImmutable $verified,
        CarbonImmutable $freshSince,
        CarbonImmutable $now,
    ): string {
        return match (true) {
            in_array($state, self::FAILED, true) => 'failed',
            $state === 'running' => $started?->gte($freshSince) ? 'running' : 'stale',
            $state === 'passed' && $verified !== null => $verified->lt($now->subDays(10)) ? 'stale' : 'passed',
            default => 'unknown',
        };
    }

    private function snapshots(array $report): array
    {
        $values = $report['snapshots'] ?? [$report['snapshot'] ?? null];

        return collect(is_array($values) ? array_slice($values, 0, 16) : [])
            ->filter(fn (mixed $value): bool => is_string($value) && $this->isSnapshotId($value))
            ->unique()
            ->values()
            ->all();
    }

    private function isSnapshotId(string $value): bool
    {
        return preg_match('/^[a-f0-9]{8,64}$/', $value) === 1;
    }

    private function date(mixed $value, CarbonImmutable $now): ?CarbonImmutable
    {
        $isIsoDateString = is_string($value)
            && strlen($value) <= 64
            && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value);

        if (! $isIsoDateString) {
            return null;
        }

        try {
            $date = CarbonImmutable::parse($value);

            return $date->gt($now->addMinutes(5)) ? null : $date;
        } catch (Throwable) {
            return null;
        }
    }
}
