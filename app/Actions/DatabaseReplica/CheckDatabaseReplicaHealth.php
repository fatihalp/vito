<?php

namespace App\Actions\DatabaseReplica;

use App\Actions\PostgresCluster\FencePostgresNode;
use App\Enums\DatabaseReplicaHealth;
use App\Exceptions\SSHError;
use App\Facades\Notifier;
use App\Models\DatabaseReplica;
use App\Models\DatabaseReplicaMetric;
use App\Notifications\DatabaseReplicaHealthChanged;
use Illuminate\Support\Number;

class CheckDatabaseReplicaHealth
{
    /**
     * @var array<string, int>
     */
    private const SEVERITY = ['healthy' => 0, 'warning' => 1, 'critical' => 2];

    private DatabaseReplicaHealth $health = DatabaseReplicaHealth::HEALTHY;

    /**
     * @var list<string>
     */
    private array $reasons = [];

    public function check(DatabaseReplica $replica): DatabaseReplicaMetric
    {
        $this->health = DatabaseReplicaHealth::HEALTHY;
        $this->reasons = [];

        $metric = new DatabaseReplicaMetric(['database_replica_id' => $replica->id]);

        $this->checkPrimary($replica, $metric);
        $this->checkReplica($replica, $metric);

        $metric->health = $this->health;
        $metric->save();

        $previous = $replica->health;
        $replica->update([
            'health' => $this->health,
            'health_reasons' => $this->reasons,
            'last_checked_at' => now(),
        ]);

        if ($this->shouldNotify($previous, $this->health)) {
            Notifier::send($replica->primary, new DatabaseReplicaHealthChanged($replica, $previous));
        }

        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        return $metric;
    }

    /**
     * A former primary that was not reachable during failover must stay down. Stop it again if it came back as a primary.
     */
    public function fenceOnSight(DatabaseReplica $replica): void
    {
        $fence = app(FencePostgresNode::class);

        if (! rescue(fn (): bool => $fence->runsAsPrimary($replica->replica), false, false)) {
            return;
        }

        $fence->fence($replica->replica);
        $previous = $replica->health;
        $replica->update([
            'health' => DatabaseReplicaHealth::CRITICAL,
            'health_reasons' => [__('The former primary :server came back and accepted writes. Vito stopped PostgreSQL on it again. Rebuild it as a replica.', ['server' => $replica->replica->name])],
            'last_checked_at' => now(),
        ]);

        Notifier::send($replica->primary, new DatabaseReplicaHealthChanged($replica, $previous));
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);
    }

    private function checkPrimary(DatabaseReplica $replica, DatabaseReplicaMetric $metric): void
    {
        try {
            $status = $replica->replication()->primaryStatus();
        } catch (SSHError) {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('Vito could not reach the primary server :server.', ['server' => $replica->primary->name]));

            return;
        }

        if ($status === null) {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('The replication slot :slot is missing on the primary. Resync the replica.', ['slot' => $replica->slot_name]));

            return;
        }

        $metric->fill([
            'state' => $status['state'] !== '' ? $status['state'] : null,
            'slot_wal_status' => $status['slot_wal_status'] !== '' ? $status['slot_wal_status'] : null,
            'slot_retained_bytes' => (int) $status['slot_retained_bytes'],
            'lag_bytes' => $status['lag_bytes'] !== '' ? max(0, (int) $status['lag_bytes']) : null,
            'write_lag_ms' => $this->latency($status, 'write_lag_ms'),
            'flush_lag_ms' => $this->latency($status, 'flush_lag_ms'),
            'replay_lag_ms' => $this->latency($status, 'replay_lag_ms'),
        ]);

        match ($metric->slot_wal_status) {
            'lost' => $this->flag(DatabaseReplicaHealth::CRITICAL, __('The primary removed WAL this replica still needed. Resync the replica.')),
            'unreserved' => $this->flag(DatabaseReplicaHealth::CRITICAL, __('The replica is so far behind that the primary is about to remove WAL it needs.')),
            'extended' => $this->flag(DatabaseReplicaHealth::WARNING, __('The primary keeps more WAL than wal_keep_size for this replica.')),
            default => null,
        };

        if ($status['slot_active'] !== 't') {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('The replica is not connected. The primary keeps :size of WAL for it.', ['size' => Number::fileSize($metric->slot_retained_bytes)]));

            return;
        }

        if ($metric->state !== 'streaming') {
            $this->flag(DatabaseReplicaHealth::WARNING, __('The replica is connected but :state, not streaming.', ['state' => $metric->state ?? 'starting']));
        }

        $this->threshold(
            $metric->lag_bytes,
            config('database-replication.lag_warning_mb') * 1048576,
            config('database-replication.lag_critical_mb') * 1048576,
            fn (int|float $value): string => __('The replica is :size behind the primary.', ['size' => Number::fileSize($value)]),
        );

        $this->threshold(
            $metric->replay_lag_ms,
            config('database-replication.replay_lag_warning_seconds') * 1000,
            config('database-replication.replay_lag_critical_seconds') * 1000,
            fn (int|float $value): string => __('Commits on the primary take :seconds s to become visible on the replica.', ['seconds' => round($value / 1000, 1)]),
        );

        $capMb = (int) $status['max_slot_wal_keep_size_mb'];
        $percent = $capMb > 0 ? $metric->slot_retained_bytes / ($capMb * 1048576) * 100 : 0;

        if ($percent >= config('database-replication.slot_retention_warning_percent')) {
            $this->flag(DatabaseReplicaHealth::WARNING, __('The slot holds :percent% of max_slot_wal_keep_size.', ['percent' => round($percent)]));
        }
    }

    private function checkReplica(DatabaseReplica $replica, DatabaseReplicaMetric $metric): void
    {
        try {
            $status = $replica->replication()->replicaStatus();
        } catch (SSHError) {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('Vito could not reach the replica server :server.', ['server' => $replica->replica->name]));

            return;
        }

        if ($status === null) {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('PostgreSQL is not accepting connections on the replica server.'));

            return;
        }

        if ($status['in_recovery'] !== 't') {
            $this->flag(DatabaseReplicaHealth::CRITICAL, __('The replica is no longer in recovery, it was promoted outside Vito.'));

            return;
        }

        if ($status['receiver_status'] !== 'streaming') {
            $this->flag(DatabaseReplicaHealth::CRITICAL, $status['receiver_status'] === ''
                ? __('The WAL receiver is not running on the replica.')
                : __('The WAL receiver on the replica is :status.', ['status' => $status['receiver_status']]));
        }

        $gap = (int) $status['replay_gap_bytes'];
        $metric->replay_delay_seconds = $gap === 0 || $status['replay_delay_seconds'] === '' ? 0 : round((float) $status['replay_delay_seconds'], 2);

        if ($metric->replay_delay_seconds >= config('database-replication.replay_delay_warning_seconds')) {
            $this->flag(DatabaseReplicaHealth::WARNING, __('The replica last replayed a transaction :seconds s ago and still has WAL to apply.', ['seconds' => round($metric->replay_delay_seconds)]));
        }
    }

    private function threshold(int|float|null $value, int|float $warning, int|float $critical, callable $message): void
    {
        if ($value === null || $value < $warning) {
            return;
        }

        $this->flag($value >= $critical ? DatabaseReplicaHealth::CRITICAL : DatabaseReplicaHealth::WARNING, $message($value));
    }

    private function flag(DatabaseReplicaHealth $health, string $reason): void
    {
        $this->reasons[] = $reason;

        if (self::SEVERITY[$health->value] > self::SEVERITY[$this->health->value]) {
            $this->health = $health;
        }
    }

    /**
     * @param  array<string, string>  $status
     */
    private function latency(array $status, string $key): ?float
    {
        if ($status['state'] !== 'streaming') {
            return null;
        }

        return $status[$key] === '' ? 0.0 : round((float) $status[$key], 2);
    }

    private function shouldNotify(DatabaseReplicaHealth $previous, DatabaseReplicaHealth $current): bool
    {
        if ($previous === $current) {
            return false;
        }

        return $current !== DatabaseReplicaHealth::HEALTHY
            || in_array($previous, [DatabaseReplicaHealth::WARNING, DatabaseReplicaHealth::CRITICAL], true);
    }
}
