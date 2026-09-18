<?php

namespace App\Console\Commands;

use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Actions\PostgresCluster\IssueClusterCertificates;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\PostgresClusterStatus;
use App\Models\PostgresCluster;
use App\Models\ServerLog;
use Illuminate\Console\Command;
use Throwable;

class RotatePostgresClusterCertificatesCommand extends Command
{
    protected $signature = 'postgres-clusters:rotate-certificates';

    protected $description = 'Renew pgBackRest TLS certificates of PostgreSQL clusters before they expire';

    public function handle(): void
    {
        $rotated = 0;

        PostgresCluster::query()
            ->where('status', PostgresClusterStatus::ACTIVE)
            ->whereNotNull('tls')
            ->whereHas('backup', fn ($query) => $query->whereNull('status'))
            ->each(function (PostgresCluster $cluster) use (&$rotated): void {
                if ($cluster->backupBusy() || $cluster->replicas()->whereIn('status', [DatabaseReplicaStatus::PENDING, DatabaseReplicaStatus::CONFIGURING, DatabaseReplicaStatus::SEEDING])->exists()) {
                    return;
                }

                try {
                    if (app(IssueClusterCertificates::class)->ensure($cluster) !== []) {
                        app(ManageDatabaseReplica::class)->syncBackupServer($cluster->refresh());
                        $rotated++;
                    }
                } catch (Throwable $e) {
                    ServerLog::log($cluster->primary, 'pgbackrest-certificate-rotation-failed', $e->getMessage());
                }
            });

        $this->info("{$rotated} clusters received new certificates");
    }
}
