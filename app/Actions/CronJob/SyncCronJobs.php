<?php

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Exceptions\SSHError;
use App\Models\CronJob;
use App\Models\Server;

class SyncCronJobs
{
    
    public function sync(Server $server): void
    {
        $users = array_values(array_filter($server->getSshUsers(), fn ($u) => is_string($u) && $u !== ''));

        foreach ($users as $user) {
            $this->syncUserCronJobs($server, $user);
        }
    }

    
    private function syncUserCronJobs(Server $server, string $user): void
    {
        
        $crontabOutput = $this->getUserCrontab($server, $user);

        
        $vitoCronJobs = $server->cronJobs()
            ->where('user', $user)
            ->get();

        $serverLevelCronJobs = $vitoCronJobs->where('site_id', null);

        if (empty($crontabOutput)) {
            
            foreach ($serverLevelCronJobs as $cronJob) {
                if ($cronJob->status === CronjobStatus::READY) {
                    $cronJob->update(['status' => CronjobStatus::DISABLED]);
                }
            }

            return;
        }

        $lines = explode("\n", trim($crontabOutput));
        $serverCronJobs = [];
        $foundCronJobs = [];

        foreach ($lines as $line) {
            $line = trim($line);

            
            if (empty($line)) {
                continue;
            }

            $isCommented = str_starts_with($line, '#');

            
            if ($isCommented) {
                $line = ltrim($line, '#');
                $line = trim($line);
            }

            
            $parts = preg_split('/\s+/', $line, 6);
            if (count($parts) < 6) {
                continue;
            }

            
            
            $isValidCronFormat = true;
            for ($i = 0; $i < 5; $i++) {
                if (! preg_match('/^[\d\*\-\/,]+$/', $parts[$i])) {
                    $isValidCronFormat = false;
                    break;
                }
            }

            if (! $isValidCronFormat) {
                continue;
            }

            $frequency = $this->normalizeFrequency(implode(' ', array_slice($parts, 0, 5)));
            $command = $this->normalizeCommand($parts[5]);

            $serverCronJobs[] = [
                'frequency' => $frequency,
                'command' => $command,
                'commented' => $isCommented,
            ];

            
            $matchingCronJob = $vitoCronJobs->first(function ($cronJob) use ($frequency, $command) {
                return $this->normalizeFrequency($cronJob->frequency) === $frequency && $this->matchesCommand($cronJob->command, $command);
            });

            if ($matchingCronJob) {
                $foundCronJobs[] = $matchingCronJob->id;

                
                if ($matchingCronJob->site_id === null) {
                    if ($isCommented && $matchingCronJob->status === CronjobStatus::READY) {
                        $matchingCronJob->update(['status' => CronjobStatus::DISABLED]);
                    } elseif (! $isCommented && $matchingCronJob->status === CronjobStatus::DISABLED) {
                        $matchingCronJob->update(['status' => CronjobStatus::READY]);
                    }
                }
            }
        }

        
        foreach ($serverLevelCronJobs as $cronJob) {
            if (! in_array($cronJob->id, $foundCronJobs) && $cronJob->status === CronjobStatus::READY) {
                $cronJob->update(['status' => CronjobStatus::DISABLED]);
            }
        }

        
        foreach ($serverCronJobs as $cronJobData) {
            $isVitoManaged = $vitoCronJobs->contains(function ($cronJob) use ($cronJobData) {
                return $this->normalizeFrequency($cronJob->frequency) === $cronJobData['frequency'] && $this->matchesCommand($cronJob->command, $cronJobData['command']);
            });

            if (! $isVitoManaged) {
                $server->cronJobs()->create([
                    'site_id' => null, 
                    'user' => $user,
                    'command' => $cronJobData['command'],
                    'frequency' => $cronJobData['frequency'],
                    'status' => $cronJobData['commented'] ? CronjobStatus::DISABLED : CronjobStatus::READY,
                ]);
            }
        }
    }

    private function normalizeFrequency(string $frequency): string
    {
        
        return preg_replace('/\s+/', ' ', trim($frequency));
    }

    private function normalizeCommand(string $command): string
    {
        
        return preg_replace('/\s+/', ' ', trim($command));
    }

    private function matchesCommand(string $cronJobCommand, string $serverCommand): bool
    {
        $normalizedCronJob = $this->normalizeCommand($cronJobCommand);
        if ($normalizedCronJob === $serverCommand) {
            return true;
        }

        $unwrapped = CronJob::unwrapCommand($serverCommand);

        return $unwrapped !== null && $this->normalizeCommand($unwrapped) === $normalizedCronJob;
    }

    
    private function getUserCrontab(Server $server, string $user): string
    {
        try {
            $output = $server->ssh($user)->exec("crontab -l 2>/dev/null || echo ''", 'get-user-crontab');
            $output = str_replace('cron updated!', '', $output);

            return trim($output);
        } catch (\Throwable) {
            return '';
        }
    }
}
