<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\ConnectionException;
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
        $latencies = [];

        foreach (self::LOCATIONS as $location => $host) {
            $latencies[$location] = $this->measureLatency($host);
        }

        return response()->json(['latencies' => $latencies]);
    }

    private function measureLatency(string $host): ?int
    {
        try {
            $start = hrtime(true);

            Http::timeout(5)
                ->withOptions(['connect_timeout' => 5])
                ->withHeaders(['Range' => 'bytes=0-0'])
                ->get("http://{$host}/100MB.bin");

            $end = hrtime(true);

            return (int) round(($end - $start) / 1_000_000);
        } catch (ConnectionException) {
            return null;
        } catch (\Exception) {
            return null;
        }
    }
}
