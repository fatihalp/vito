<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;
use Cron\CronExpression;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncCronJobs
{
    public function sync(Server $server, array $users = []): array
    {
        $users = $users === [] ? $server->getSshUsers() : $users;
        $errors = [];

        foreach (array_unique(array_filter($users, fn (mixed $user): bool => is_string($user) && $user !== '')) as $user) {
            try {
                $this->syncUser($server, $user);
            } catch (Throwable $e) {
                $errors[$user] = $e->getMessage();
            }
        }

        return $errors;
    }

    public function write(Server $server, string $user): void
    {
        $entries = $this->parseCrontab($this->getUserCrontab($server, $user));
        $unmanagedLines = array_column(array_filter($entries, fn (array $entry): bool => $entry['frequency'] === null), 'raw');

        $server->cron()->update($user, implode("\n", array_filter([...$unmanagedLines, CronJob::crontab($server, $user)])));
    }

    private function syncUser(Server $server, string $user): void
    {
        $entries = $this->parseCrontab($this->getUserCrontab($server, $user));
        $unmanagedLines = array_column(array_filter($entries, fn (array $entry): bool => $entry['frequency'] === null), 'raw');
        $activeLines = array_column(array_filter($entries, fn (array $entry): bool => $entry['frequency'] !== null && ! $entry['commented']), 'line');

        DB::transaction(function () use ($server, $user, $entries): void {
            $cronJobs = $server->cronJobs()->where('user', $user)->with('site')->get();

            if ($user !== 'root') {
                $this->unwrapStoredCommands($cronJobs);
            }

            $managed = $this->signatures($cronJobs);
            $matchedIds = [];

            foreach ($entries as $entry) {
                if ($entry['frequency'] === null) {
                    continue;
                }

                $cronJob = $managed[$this->signature($entry['frequency'], $entry['command'])] ?? null;

                if (! $cronJob instanceof CronJob) {
                    $server->cronJobs()->create([
                        'site_id' => null,
                        'user' => $user,
                        'command' => $this->normalize($user === 'root' ? $entry['command'] : CronJob::unwrapAll($entry['command'])),
                        'frequency' => $entry['frequency'],
                        'status' => $entry['commented'] ? CronjobStatus::DISABLED : CronjobStatus::READY,
                    ]);

                    continue;
                }

                $matchedIds[$cronJob->id] = true;

                if ($cronJob->site_id === null) {
                    $this->syncStatus($cronJob, $entry['commented'] ? CronjobStatus::DISABLED : CronjobStatus::READY);
                }
            }

            $cronJobs
                ->filter(fn (CronJob $cronJob): bool => $cronJob->site_id === null && ! isset($matchedIds[$cronJob->id]))
                ->each(fn (CronJob $cronJob) => $this->syncStatus($cronJob, CronjobStatus::DISABLED));
        });

        $desiredLines = array_values(array_filter(explode("\n", CronJob::crontab($server, $user)), fn (string $line): bool => $line !== ''));

        if (array_diff(array_map($this->normalize(...), $desiredLines), $activeLines) !== []) {
            $server->cron()->update($user, implode("\n", [...$unmanagedLines, ...$desiredLines]));
        }
    }

    private function parseCrontab(string $crontab): array
    {
        $entries = [];

        foreach (explode("\n", $crontab) as $raw) {
            $raw = trim($raw);

            if ($raw === '') {
                continue;
            }

            $commented = str_starts_with($raw, '#');
            $line = $this->normalize($commented ? ltrim($raw, '#') : $raw);
            $parts = explode(' ', $line, str_starts_with($line, '@') ? 2 : 6);
            $command = count($parts) > 1 ? (string) array_pop($parts) : '';
            $frequency = implode(' ', $parts);
            $isCron = $command !== '' && CronExpression::isValidExpression($frequency);

            $entries[] = [
                'raw' => $raw,
                'line' => $line,
                'commented' => $commented,
                'frequency' => $isCron ? $frequency : null,
                'command' => $command,
            ];
        }

        return $entries;
    }

    private function unwrapStoredCommands(Collection $cronJobs): void
    {
        foreach ($cronJobs as $cronJob) {
            $command = CronJob::unwrapAll($cronJob->command);

            if ($command !== $cronJob->command) {
                $cronJob->update(['command' => $command]);
            }
        }
    }

    private function signatures(Collection $cronJobs): array
    {
        $signatures = [];

        foreach ($cronJobs as $cronJob) {
            $commands = [$cronJob->command, $cronJob->executionCommand()];

            if ($cronJob->site) {
                $commands[] = "cd {$cronJob->site->path} && ({$cronJob->command})";
                $commands[] = 'cd '.escapeshellarg($cronJob->site->path)." && ({$cronJob->command})";
            }

            foreach ($commands as $command) {
                $signatures[$this->signature($cronJob->frequency, $command)] ??= $cronJob;
            }
        }

        return $signatures;
    }

    private function signature(string $frequency, string $command): string
    {
        return $this->normalize($frequency)."\n".$this->normalize(CronJob::unwrapAll($command));
    }

    private function syncStatus(CronJob $cronJob, CronjobStatus $status): void
    {
        if ($cronJob->status !== $status && in_array($cronJob->status, [CronjobStatus::READY, CronjobStatus::DISABLED], true)) {
            $cronJob->update(['status' => $status]);
        }
    }

    private function normalize(string $value): string
    {
        return (string) preg_replace('/\s+/', ' ', trim($value));
    }

    private function getUserCrontab(Server $server, string $user): string
    {
        $output = $server->ssh($user)->exec("crontab -l 2>/dev/null || echo ''", 'get-user-crontab');

        return trim(str_replace('cron updated!', '', $output));
    }
}
