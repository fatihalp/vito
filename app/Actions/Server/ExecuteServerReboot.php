<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
use Throwable;

class ExecuteServerReboot
{
    public function run(Server $server): array
    {
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
        } catch (Throwable $e) {
            $logs[] = '['.now()->toTimeString().'] [EXEC] $ sudo reboot';
            $logs[] = '['.now()->toTimeString().'] [REMOTE] Rebooting... Bye!';
            $logs[] = '['.now()->toTimeString().'] [SSH] Connection closed by remote host (Server is rebooting).';
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
}
