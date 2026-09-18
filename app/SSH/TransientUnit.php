<?php

namespace App\SSH;

use App\Models\Server;

class TransientUnit
{
    public function __construct(protected Server $server, protected string $unit) {}

    /**
     * Writes the script to /var/lib/vito and runs it as root in this unit, replacing a finished run of the same unit.
     */
    public function start(string $script, string $description): void
    {
        $this->server->ssh()->exec(view('ssh.transient-unit-start', [
            'unit' => $this->unit,
            'path' => '/var/lib/vito/'.$this->unit.'.sh',
            'script' => $script,
            'description' => $description,
        ]), $this->unit);
    }

    public function state(): string
    {
        $output = $this->server->ssh()->clearLog()->exec(
            'sudo systemctl show '.escapeshellarg($this->unit).' --property=LoadState,ActiveState,SubState,Result'
        );

        preg_match_all('/^(\w+)=(.*)$/m', $output, $matches);
        $properties = array_combine($matches[1], array_map(trim(...), $matches[2]));

        return match (true) {
            ($properties['LoadState'] ?? '') === 'not-found' => 'missing',
            ($properties['ActiveState'] ?? '') === 'failed', ($properties['Result'] ?? 'success') !== 'success' => 'failed',
            ($properties['SubState'] ?? '') === 'exited', ($properties['ActiveState'] ?? '') === 'inactive' => 'succeeded',
            default => 'running',
        };
    }

    /**
     * The error lines of the unit's output: pgBackRest and PostgreSQL errors, hints, and the message of a storage error
     * response (for example a Backblaze cap), so alerts show the cause instead of HTTP headers. Else its last 15 lines.
     */
    public function failureReason(): string
    {
        $lines = preg_split('/\R/', $this->output(80, 'cat')) ?: [];
        $reasons = collect($lines)
            ->filter(fn (string $line): bool => preg_match('/ERROR|FATAL|HINT:|<Message>/', $line) === 1)
            ->map(fn (string $line): string => html_entity_decode(trim(strip_tags($line))))
            ->unique()
            ->take(-6);

        return $reasons->isNotEmpty() ? $reasons->implode("\n") : implode("\n", array_slice($lines, -15));
    }

    public function output(int $lines, string $format = 'short-iso'): string
    {
        return trim($this->server->ssh()->clearLog()->exec(
            'sudo journalctl -u '.escapeshellarg($this->unit).' -n '.$lines.' --no-pager -o '.$format.' || true'
        ));
    }

    public function cleanup(): void
    {
        $unit = escapeshellarg($this->unit);

        $this->server->ssh()->clearLog()->exec(
            "sudo systemctl stop {$unit} > /dev/null 2>&1 || true; sudo systemctl reset-failed {$unit} > /dev/null 2>&1 || true"
        );
    }
}
