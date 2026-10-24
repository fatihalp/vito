<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('hetzner')]
#[Middleware(['auth'])]
class HetznerController extends Controller
{
    private const LOCATIONS = [
        'fsn1' => 'fsn1-speed.hetzner.com',
        'nbg1' => 'nbg1-speed.hetzner.com',
        'hel1' => 'hel1-speed.hetzner.com',
        'ash' => 'ash-speed.hetzner.com',
        'hil' => 'hil-speed.hetzner.com',
        'sin' => 'sin-speed.hetzner.com',
    ];

    

    #[Get('/latency', name: 'hetzner.latency')]
    public function latency(): JsonResponse
    {
        $latencies = Cache::get('hetzner:latencies') ?? tap($this->measure(), function (array $latencies): void {
            Cache::put('hetzner:latencies', $latencies, in_array(null, $latencies, true) ? now()->addMinutes(5) : now()->addHours(6));
        });

        return response()->json(['latencies' => $latencies]);
    }

    /**
     * @return array<string, ?int>
     */
    private function measure(): array
    {
        $responses = Http::pool(fn (Pool $pool) => collect(self::LOCATIONS)
            ->map(fn (string $host, string $location) => $pool->as($location)->timeout(5)->connectTimeout(5)->withHeaders(['Range' => 'bytes=0-0'])->get("http://{$host}/100MB.bin"))
            ->all());

        return collect(self::LOCATIONS)
            ->map(fn (string $host, string $location): ?int => ($responses[$location] ?? null) instanceof Response
                ? (int) round($responses[$location]->transferStats?->getTransferTime() * 1000)
                : null)
            ->all();
    }
}
