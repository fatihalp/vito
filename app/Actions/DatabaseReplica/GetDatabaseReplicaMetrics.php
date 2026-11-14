<?php

namespace App\Actions\DatabaseReplica;

use App\Http\Resources\DatabaseReplicaMetricResource;
use App\Models\DatabaseReplica;
use App\Models\DatabaseReplicaMetric;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use stdClass;

class GetDatabaseReplicaMetrics
{
    private const PERIODS = ['1h' => 60, '24h' => 1440, '7d' => 10080, '30d' => 43200];

    private const MAX_POINTS = 240;

    private const WORST_COLUMNS = ['lag_bytes', 'replay_delay_seconds', 'write_lag_ms', 'flush_lag_ms', 'replay_lag_ms', 'slot_retained_bytes'];

    public function get(DatabaseReplica $replica, array $input): array
    {
        $period = Validator::make($input, [
            'period' => ['sometimes', Rule::in(array_keys(self::PERIODS))],
        ])->validate()['period'] ?? '24h';

        $bucketSeconds = (int) ceil(self::PERIODS[$period] * 60 / self::MAX_POINTS);

        $buckets = $replica->metrics()
            ->where('created_at', '>=', now()->subMinutes(self::PERIODS[$period]))
            ->selectRaw(
                'MAX(id) as last_id, '.implode(', ', array_map(fn (string $column): string => "MAX({$column}) as {$column}", self::WORST_COLUMNS))
                .", CAST(strftime('%s', created_at) / ? AS INTEGER) as bucket",
                [$bucketSeconds],
            )
            ->groupByRaw('bucket')
            ->orderBy('bucket')
            ->toBase()
            ->get();

        $lastMetrics = DatabaseReplicaMetric::query()->findMany($buckets->pluck('last_id'))->keyBy('id');

        return [
            'period' => $period,
            'metrics' => $buckets->map(fn (stdClass $bucket): array => [
                ...DatabaseReplicaMetricResource::make($lastMetrics[$bucket->last_id])->resolve(),
                ...Arr::only((array) $bucket, self::WORST_COLUMNS),
            ]),
        ];
    }
}
