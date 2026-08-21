<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Process\Process;

class VitoCommand extends Command
{
    protected $signature = 'vito
        {--serve : Start the PHP built-in web server}
        {--host=127.0.0.1 : The host address to serve the application on}
        {--port=8000 : The port to serve the application on}
        {--ws-port=8085 : The port for the WebSocket server}
        {--no-horizon : Disable starting Laravel Horizon}
        {--no-schedule : Disable starting the schedule worker}
        {--no-ws : Disable starting the WebSocket server}';

    protected $description = 'Start all required Vito background services (Horizon, Schedule, WebSocket, and optional Web Server)';

    
    protected array $processes = [];

    public function handle(): int
    {
        $phpBinary = (new PhpExecutableFinder)->find(false) ?: 'php';
        $artisan = base_path('artisan');

        $this->components->info('Clearing cached config, routes, views, and events...');
        $this->call('optimize:clear');

        if (! $this->option('no-horizon')) {
            $this->components->info('Terminating any running Horizon master process...');
            $this->call('horizon:terminate');
        }

        $services = [];

        if (! $this->option('no-horizon')) {
            $services['Horizon'] = [
                'cmd' => [$phpBinary, $artisan, 'horizon'],
                'color' => 'magenta',
            ];
        }

        if (! $this->option('no-schedule')) {
            $services['Schedule'] = [
                'cmd' => [$phpBinary, $artisan, 'schedule:work'],
                'color' => 'blue',
            ];
        }

        if (! $this->option('no-ws')) {
            $wsPort = (string) ($this->option('ws-port') ?? config('core.ws_port', '8085'));
            $services['WebSocket'] = [
                'cmd' => [$phpBinary, $artisan, 'ws:serve', "--port={$wsPort}"],
                'color' => 'green',
            ];
        }

        if ($this->option('serve')) {
            $host = (string) $this->option('host');
            $port = (string) $this->option('port');
            $services['Server'] = [
                'cmd' => [$phpBinary, $artisan, 'serve', "--host={$host}", "--port={$port}"],
                'color' => 'yellow',
            ];
        }

        if (empty($services)) {
            $this->warn('No services selected to run.');

            return 0;
        }

        $this->components->info('Starting Vito services: '.implode(', ', array_keys($services)));

        foreach ($services as $name => $service) {
            $process = new Process($service['cmd'], base_path());
            $process->setTimeout(null);
            $process->start();
            $this->processes[$name] = $process;
        }

        $this->registerSignalHandlers();

        while ($this->anyProcessRunning()) {
            foreach ($this->processes as $name => $process) {
                $color = $services[$name]['color'];

                $output = $process->getIncrementalOutput();
                if ($output !== '') {
                    $this->printFormattedOutput($name, $color, $output);
                }

                $errorOutput = $process->getIncrementalErrorOutput();
                if ($errorOutput !== '') {
                    $this->printFormattedOutput($name, $color, $errorOutput, isError: true);
                }

                if (! $process->isRunning() && $process->getExitCode() !== 0) {
                    $this->error("[{$name}] Process exited unexpectedly with code {$process->getExitCode()}");
                }
            }

            usleep(50000);
        }

        return 0;
    }

    protected function anyProcessRunning(): bool
    {
        foreach ($this->processes as $process) {
            if ($process->isRunning()) {
                return true;
            }
        }

        return false;
    }

    protected function registerSignalHandlers(): void
    {
        if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
            pcntl_async_signals(true);

            $shutdown = function (): void {
                $this->stopAllProcesses();
                exit(0);
            };

            pcntl_signal(SIGINT, $shutdown);
            pcntl_signal(SIGTERM, $shutdown);
            if (defined('SIGHUP')) {
                pcntl_signal(SIGHUP, $shutdown);
            }
        }
    }

    protected function stopAllProcesses(): void
    {
        $this->newLine();
        $this->components->info('Stopping all Vito services...');

        foreach ($this->processes as $name => $process) {
            if ($process->isRunning()) {
                $this->line("Stopping <fg=gray>[{$name}]</>...");
                $process->stop(5);
            }
        }

        $this->components->info('All Vito services stopped.');
    }

    protected function printFormattedOutput(string $service, string $color, string $content, bool $isError = false): void
    {
        $lines = preg_split("/\r\n|\n|\r/", trim($content));
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            if (trim($line) === '') {
                continue;
            }

            $prefix = "<fg={$color};options=bold>[{$service}]</>";
            if ($isError) {
                $this->output->writeln("{$prefix} <fg=red>{$line}</>");
            } else {
                $this->output->writeln("{$prefix} {$line}");
            }
        }
    }
}
