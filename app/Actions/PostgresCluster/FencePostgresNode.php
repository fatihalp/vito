<?php

namespace App\Actions\PostgresCluster;

use App\Models\Server;
use App\SSH\PostgresReplication;

class FencePostgresNode
{
    /**
     * Stops PostgreSQL, WAL archiving and the pgBackRest TLS server on a former primary and keeps PostgreSQL from starting again.
     */
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

    /**
     * Returns true when the server runs PostgreSQL outside recovery, which means a fenced former primary came back.
     */
    public function runsAsPrimary(Server $server): bool
    {
        $output = $server->ssh()->clearLog()->exec(view('ssh.database-replication.fence-status'));

        return preg_match('/^VITO_FENCE=f$/m', $output) === 1;
    }
}
