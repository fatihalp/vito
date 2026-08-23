<?php

namespace App\Jobs\Server\Security;

use App\DTOs\SocketEventDTO;
use App\Enums\SecurityControlStatus;
use App\Events\SocketEvent;
use App\Models\Server;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ApplySecuritySettingJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected Server $server,
        protected string $setting,
        protected bool $enabled
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->server->id}", function (): void {
            if ($this->setting === 'root_login') {
                if (! $this->enabled && $this->server->getSshUser() === 'root') {
                    $this->writeState(['status' => SecurityControlStatus::FAILED->value]);
                    ServerLog::log($this->server, 'disable-root-login-failed', 'Refusing to disable root login while Vito connects as root.');
                    $this->broadcast();

                    return;
                }
                $this->server->security()->setRootLogin($this->enabled);
                $detected = $this->server->security()->rootLoginEnabled();
            } else {
                $this->server->security()->setPasswordAuth($this->enabled);
                $detected = $this->server->security()->passwordAuthEnabled();
            }

            $this->writeState([
                'enabled' => $this->enabled,
                'detected' => $detected,
                'status' => SecurityControlStatus::READY->value,
            ]);

            $this->broadcast();
        });
    }

    public function failed(Exception $e): void
    {
        $this->writeState([
            'status' => SecurityControlStatus::FAILED->value,
        ]);

        $action = $this->enabled ? 'enable' : 'disable';
        $logKey = $this->setting === 'root_login' ? 'root-login' : 'password-auth';
        
        ServerLog::log($this->server, "{$action}-{$logKey}-failed", $e->getMessage());

        $this->broadcast();
    }

    private function writeState(array $values): void
    {
        $this->server->refresh();
        $security = $this->server->feature_data['security'] ?? [];
        $key = ($this->setting === 'password_auth' || $this->setting === 'password_authentication')
            ? 'password_authentication'
            : $this->setting;
        $security[$key] = array_merge($security[$key] ?? [], $values);
        $this->server->jsonUpdate('feature_data', 'security', $security);
    }

    private function broadcast(): void
    {
        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->server->project_id,
            type: 'security.updated',
            data: ['server_id' => $this->server->id],
        ));
    }
}
