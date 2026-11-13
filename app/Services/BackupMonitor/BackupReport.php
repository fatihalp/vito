<?php

namespace App\Services\BackupMonitor;

use Carbon\CarbonImmutable;
use Throwable;

class BackupReport
{
    public function parse(array $report, int $maxAgeHours, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $state = $report['state'] ?? $report['status'] ?? null;
        $success = $this->date($report['last_success_at'] ?? (in_array($state, ['healthy', 'passed', 'success'], true) ? ($report['finished_at'] ?? null) : null), $now);
        $restore = is_array($report['restore_test'] ?? null) ? $report['restore_test'] : [];
        $verified = $this->date($restore['verified_at'] ?? $restore['checked_at'] ?? null, $now);
        $restoreState = $restore['state'] ?? $restore['sqlite_restore'] ?? null;
        $started = $this->date($report['started_at'] ?? null, $now);
        $verifyStarted = $this->date($restore['started_at'] ?? $restore['checked_at'] ?? null, $now);
        $overdue = $success !== null && $success->lt($now->subHours($maxAgeHours));
        $status = match (true) {
            in_array($state, ['failed', 'error'], true) => 'failed',
            $overdue => 'warning',
            $state === 'running' && $started !== null && $started->gte($now->subHours($maxAgeHours)) => 'running',
            $success === null => 'unknown',
            in_array($state, ['healthy', 'passed', 'success', 'finished'], true) => 'healthy',
            default => 'unknown',
        };
        $verification = match (true) {
            in_array($restoreState, ['failed', 'error'], true) => 'failed',
            $restoreState === 'running' => $verifyStarted !== null && $verifyStarted->gte($now->subHours($maxAgeHours)) ? 'running' : 'stale',
            $restoreState === 'passed' && $verified !== null => $verified->lt($now->subDays(10)) ? 'stale' : 'passed',
            default => 'unknown',
        };
        if ($status === 'healthy' && in_array($verification, ['failed', 'stale'], true)) {
            $status = 'warning';
        }
        $snapshots = [];
        $values = $report['snapshots'] ?? [$report['snapshot'] ?? null];
        foreach (is_array($values) ? array_slice($values, 0, 16) : [] as $value) {
            if (is_string($value) && preg_match('/^[a-f0-9]{8,64}$/', $value)) {
                $snapshots[] = $value;
            }
        }

        $errorCode = match ($status) {
            'failed' => 'backup_failed',
            'warning' => $overdue ? 'overdue' : 'verification_attention',
            'unknown' => 'unverified',
            default => null,
        };

        return ['status' => $status, 'details' => [
            'last_success_at' => $success?->toIso8601String(),
            'restore_state' => $verification,
            'restore_verified_at' => $verified?->toIso8601String(),
            'snapshots' => array_values(array_unique($snapshots)),
            'error_code' => $errorCode,
        ]];
    }

    private function date(mixed $value, CarbonImmutable $now): ?CarbonImmutable
    {
        if (! is_string($value) || strlen($value) > 64 || ! preg_match('/^\d{4}-\d{2}-\d{2}T/', $value)) {
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
