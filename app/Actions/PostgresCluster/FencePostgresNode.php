<?php

namespace App\Actions\PostgresCluster;

use App\Models\Server;
use App\SSH\PostgresReplication;

class FencePostgresNode
{
    public function fence(Server $server): void
    {
        $server->ssh()->exec(
            view('ssh.database-replication.fence', [
                'confDirectory' => PostgresReplication::confDirectory($server),
                'version' => $server->database()?->version,
            ]),
            'postgres-fence'
        );
    }

    public function runsAsPrimary(Server $server): bool
    {
        $output = $server->ssh()->clearLog()->exec(view('ssh.database-replication.fence-status'));

        return preg_match('/^VITO_FENCE=f$/m', $output) === 1;
    }
}
