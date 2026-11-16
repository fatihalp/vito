<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Exceptions\SSHCommandError;
use App\Models\Server;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class ExecuteServerReboot
{
    public function run(Server $server): array
    {
        $this->rememberPendingReboot($server, $this->currentBootId($server));
        $logs = [];
        $logs[] = '['.now()->toTimeString().'] [INIT] Preparing server reboot sequence...';
        $logs[] = '['.now()->toTimeString().'] [SSH] Connecting to '.$server->ip.':'.$server->port.' as '.$server->getSshUser().'...';

        try {
            $output = $server->ssh()->exec(
                view('ssh.os.reboot'),
                'reboot'
            );

            $logs[] = '['.now()->toTimeString().'] [EXEC] $ sudo reboot';
            if (! empty(trim($output))) {
                $logs[] = '['.now()->toTimeString().'] [REMOTE] '.trim($output);
            }
        } catch (SSHCommandError $e) {
            $logs[] = '['.now()->toTimeString().'] [EXEC] $ sudo reboot';
            $logs[] = '['.now()->toTimeString().'] [SSH] Response interrupted. Waiting to verify a new boot session.';
        } catch (Throwable $e) {
            Cache::forget($this->pendingRebootKey($server));
            throw $e;
        }

        $server->status = ServerStatus::DISCONNECTED;
        $server->save();
        app(BroadcastServerUpdate::class)->broadcast($server);

        $logs[] = '['.now()->toTimeString().'] [STATUS] Server status set to disconnected.';
        $logs[] = '['.now()->toTimeString().'] [POLL] Starting auto-reconnect polling loop...';

        return [
            'success' => true,
            'logs' => $logs,
        ];
    }

    private function currentBootId(Server $server): string
    {
        $bootId = trim($server->ssh()->exec('cat /proc/sys/kernel/random/boot_id && sudo -n true', timeout: 10));

        if (preg_match('/^[a-f0-9-]{36}$/', $bootId) !== 1) {
            throw ValidationException::withMessages([
                'server' => 'Could not verify the server before restarting.',
            ]);
        }

        return $bootId;
    }

    private function rememberPendingReboot(Server $server, string $bootId): void
    {
        Cache::put(
            $this->pendingRebootKey($server),
            ['boot_id' => $bootId, 'requested_at' => now()->timestamp],
            now()->addHour(),
        );
    }

    private function pendingRebootKey(Server $server): string
    {
        return 'server.pending-reboot.'.$server->id;
    }
}
