<?php

use App\Enums\PgBackRestStrategy;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_files', function (Blueprint $table): void {
            $table->unsignedBigInteger('server_id')->nullable();
            $table->string('type')->nullable();
        });

        Schema::create('postgres_clusters', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id')->index();
            $table->unsignedBigInteger('primary_server_id')->index();
            $table->unsignedBigInteger('backup_id')->nullable()->index();
            $table->unsignedBigInteger('network_id')->nullable();
            $table->boolean('owns_network')->default(false);
            $table->string('stanza')->unique();
            $table->text('tls')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        DB::table('backups')->where('type', 'pgbackrest')->orderBy('id')->each(function (object $backup): void {
            $configuration = json_decode(Crypt::decryptString($backup->configuration), true);
            $server = DB::table('servers')->where('id', $backup->server_id)->first();

            if (! is_array($configuration) || $server === null) {
                return;
            }

            DB::table('postgres_clusters')->insert([
                'project_id' => $server->project_id,
                'primary_server_id' => $server->id,
                'backup_id' => $backup->id,
                'stanza' => $configuration['stanza'] ?? (Str::slug($server->name) ?: 'server').'-'.$server->id,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            unset($configuration['stanza'], $configuration['full_every_days']);
            $configuration = [...$configuration, ...PgBackRestStrategy::standard(), 'strategy' => PgBackRestStrategy::STANDARD->value];

            DB::table('backups')->where('id', $backup->id)->update([
                'configuration' => Crypt::encryptString(json_encode($configuration)),
                'interval' => $configuration['schedules']['full'],
                'keep_backups' => $configuration['retention']['full'],
            ]);
        });

        Schema::create('database_replicas', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('postgres_cluster_id')->index();
            $table->unsignedBigInteger('replica_server_id')->index();
            $table->string('status');
            $table->string('health')->default('unknown');
            $table->json('health_reasons')->nullable();
            $table->string('slot_name');
            $table->string('username');
            $table->text('password');
            $table->unsignedInteger('max_slot_wal_keep_size_gb');
            $table->json('configuration')->nullable();
            $table->float('progress')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('database_replica_metrics', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('database_replica_id');
            $table->string('health');
            $table->string('state')->nullable();
            $table->bigInteger('lag_bytes')->nullable();
            $table->float('replay_delay_seconds')->nullable();
            $table->float('write_lag_ms')->nullable();
            $table->float('flush_lag_ms')->nullable();
            $table->float('replay_lag_ms')->nullable();
            $table->bigInteger('slot_retained_bytes')->nullable();
            $table->string('slot_wal_status')->nullable();
            $table->timestamps();

            $table->index(['database_replica_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_replica_metrics');
        Schema::dropIfExists('database_replicas');
        Schema::dropIfExists('postgres_clusters');

        Schema::table('backup_files', function (Blueprint $table): void {
            $table->dropColumn(['server_id', 'type']);
        });
    }
};
