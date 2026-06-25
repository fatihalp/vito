<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('hetzner')]
#[Middleware(['auth', 'has-project'])]
class HetznerLatencyController extends Controller
{
    private const REGIONS = [
        'fsn1' => 'http://fsn1-speed.hetzner.com/100MB.bin',
        'nbg1' => 'http://nbg1-speed.hetzner.com/100MB.bin',
        'hel1' => 'http://hel1-speed.hetzner.com/100MB.bin',
        'ash' => 'http://ash-speed.hetzner.com/100MB.bin',
        'hil' => 'http://hil-speed.hetzner.com/100MB.bin',
        'sin' => 'http://sin-speed.hetzner.com/100MB.bin',
    ];

    #[Get('/latency', name: 'hetzner.latency')]
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'latencies' => collect(self::REGIONS)->map(fn (string $url): ?int => $this->measure($url)),
        ]);
    }

    private function measure(string $url): ?int
    {
        $samples = [];

        foreach (range(1, 3) as $sample) {
            $startedAt = hrtime(true);

            try {
                Http::timeout(5)
                    ->connectTimeout(3)
                    ->withHeaders(['Range' => 'bytes=0-0'])
                    ->get($url)
                    ->throw();

                $samples[] = (int) round((hrtime(true) - $startedAt) / 1_000_000);
            } catch (\Throwable) {
                if ($samples === []) {
                    return null;
                }
            }
        }

        return min($samples);
    }
}
