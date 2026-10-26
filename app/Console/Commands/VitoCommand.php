<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;

class VitoCommand extends Command
{
    protected $signature = 'vito
        {--no-build : Skip building frontend assets}
        {--no-restart : Skip restarting Vito background services}';

    protected $description = 'Prepare Vito after an update and restart its background services';

    public function handle(): int
    {
        foreach (['optimize:clear' => [], 'migrate' => ['--force' => true]] as $command => $arguments) {
            if ($this->call($command, $arguments) !== self::SUCCESS) {
                return self::FAILURE;
            }
        }

        if (! $this->option('no-build')) {
            if (! is_dir(base_path('node_modules')) && ! $this->runProcess(['npm', 'install'], 600)) {
                return self::FAILURE;
            }

            if (! $this->runProcess(['npm', 'run', 'build'], 600)) {
                return self::FAILURE;
            }
        }

        foreach (['config:cache', 'event:cache', 'route:cache', 'view:cache'] as $command) {
            if ($this->call($command) !== self::SUCCESS) {
                return self::FAILURE;
            }
        }

        if (! $this->option('no-restart')) {
            foreach (['queue:restart', 'schedule:interrupt'] as $command) {
                if ($this->call($command) !== self::SUCCESS) {
                    return self::FAILURE;
                }
            }

            if (! $this->runProcess(['sh', '-c', 'nohup sh -c "sleep 2 && sudo -n supervisorctl restart worker:* websocket" >/dev/null 2>&1 &'], 30)) {
                return self::FAILURE;
            }
        }

        $this->components->info('Vito update maintenance completed.');

        return self::SUCCESS;
    }

    /** @param list<string> $command */
    private function runProcess(array $command, int $timeout): bool
    {
        $this->components->info('Running '.implode(' ', $command).'...');

        $result = Process::path(base_path())->timeout($timeout)->run(
            $command,
            fn (string $type, string $output) => $this->output->write($output),
        );

        if ($result->failed()) {
            $this->error('Command failed: '.implode(' ', $command));

            return false;
        }

        return true;
    }
}
