<?php

namespace App\Actions\DatabaseReplica;

use App\Http\Resources\DatabaseReplicaMetricResource;
use App\Models\DatabaseReplica;
use App\Models\DatabaseReplicaMetric;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetDatabaseReplicaMetrics
{
    /**
     * @var array<string, int>
     */
    private const PERIODS = ['1h' => 60, '24h' => 1440, '7d' => 10080, '30d' => 43200];

    private const MAX_POINTS = 240;

    /**
     * @return array{period: string, metrics: Collection<int, array<string, mixed>>}
     */
    public function get(DatabaseReplica $replica, array $input): array
    {
        $period = Validator::make($input, [
            'period' => ['sometimes', Rule::in(array_keys(self::PERIODS))],
        ])->validate()['period'] ?? '24h';

        $metrics = $replica->metrics()
            ->where('created_at', '>=', now()->subMinutes(self::PERIODS[$period]))
            ->orderBy('created_at')
            ->get();

        $size = max(1, (int) ceil($metrics->count() / self::MAX_POINTS));

        return [
            'period' => $period,
            'metrics' => $metrics
                ->chunk($size)
                ->map(fn (Collection $bucket): array => $this->bucket($bucket))
                ->values(),
        ];
    }

    /**
     * @param  Collection<int, DatabaseReplicaMetric>  $bucket
     * @return array<string, mixed>
     */
    private function bucket(Collection $bucket): array
    {
        $last = $bucket->last();
        $worst = fn (string $key): float|int|null => $bucket->whereNotNull($key)->max($key);

        return [
            ...DatabaseReplicaMetricResource::make($last)->resolve(),
            'lag_bytes' => $worst('lag_bytes'),
            'replay_delay_seconds' => $worst('replay_delay_seconds'),
            'write_lag_ms' => $worst('write_lag_ms'),
            'flush_lag_ms' => $worst('flush_lag_ms'),
            'replay_lag_ms' => $worst('replay_lag_ms'),
            'slot_retained_bytes' => $worst('slot_retained_bytes'),
        ];
    }
}
