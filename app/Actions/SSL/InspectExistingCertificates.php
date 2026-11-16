<?php

namespace App\Actions\SSL;

use App\Models\Server;
use App\Models\Ssl;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class InspectExistingCertificates
{
    public function inspect(Server $server): array
    {
        return Cache::remember('certificate-observations:'.$server->id, 600, fn (): array => Cache::lock('certificate-observations-lock:'.$server->id, 30)->block(1, function () use ($server): array {
            $output = $server->ssh()->clearLog()->exec(view('ssh.ssl.inspect-existing'), timeout: 22, outputLimit: 1048576);
            $report = json_decode($output, true, 8, JSON_THROW_ON_ERROR);
            $registered = Ssl::query()->where(fn ($query) => $query->where('server_id', $server->id)->orWhereHas('site', fn ($query) => $query->where('server_id', $server->id)))
                ->whereNotNull('certificate')->get(['id', 'certificate'])->map(fn (Ssl $ssl) => @openssl_x509_fingerprint($ssl->certificate, 'sha256'))->filter()->values()->all();

            return $this->normalize($report, $registered);
        }));
    }

    public function normalize(array $report, array $registered = []): array
    {
        if (! is_array($report['certificates'] ?? null) || ! array_is_list($report['certificates']) || count($report['certificates']) > 50 || ! is_int($report['discovered'] ?? null) || ! is_int($report['unreadable'] ?? null)) {
            throw ValidationException::withMessages(['certificate' => __('The certificate inventory is invalid.')]);
        }
        if ($report['discovered'] < count($report['certificates']) + $report['unreadable'] || $report['unreadable'] < 0) {
            throw ValidationException::withMessages(['certificate' => __('The certificate inventory is invalid.')]);
        }
        $rows = [];
        $unreadable = max(0, $report['unreadable']);
        foreach ($report['certificates'] as $encoded) {
            $pem = is_string($encoded) && strlen($encoded) <= 22000 ? base64_decode($encoded, true) : false;
            try {
                if (! $pem || ! str_starts_with($pem, '-----BEGIN CERTIFICATE-----')) {
                    throw new \RuntimeException('Invalid public certificate');
                }
                $data = CertificateParser::parse($pem);
                $fingerprint = openssl_x509_fingerprint($pem, 'sha256');
                $parsed = openssl_x509_parse($pem);
                $expires = CarbonImmutable::instance($data['expires_at']);
                $now = CarbonImmutable::now();
                $status = $expires->isPast() ? 'expired' : ($expires->lte($now->addDays(30)) ? 'expiring' : 'valid');
                if (($parsed['validFrom_time_t'] ?? 0) > $now->timestamp) {
                    $status = 'not-yet-valid';
                }
                $rows[$fingerprint] = ['fingerprint' => $fingerprint, 'domains' => array_slice($data['domains'], 0, 100), 'expires_at' => $expires->toIso8601String(), 'days_remaining' => (int) floor(($expires->timestamp - $now->timestamp) / 86400), 'status' => $status, 'registered' => in_array($fingerprint, $registered, true)];
            } catch (Throwable) {
                $unreadable++;
            }
        }

        return ['checked_at' => now()->toIso8601String(), 'certificates' => array_values($rows), 'discovered' => max(0, $report['discovered']), 'unreadable' => $unreadable, 'complete' => ($report['complete'] ?? false) === true && $unreadable === 0];
    }
}
