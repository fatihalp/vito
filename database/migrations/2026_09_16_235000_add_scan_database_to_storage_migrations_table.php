<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->unsignedBigInteger('database_id')->nullable();
            $table->unsignedBigInteger('database_user_id')->nullable();
            $table->unsignedBigInteger('firewall_rule_id')->nullable();
        });

        DB::table('storage_migrations')->whereNull('deleted_at')->update(['deleted_at' => now()]);

        Schema::dropIfExists('storage_migration_items');
    }

    public function down(): void
    {
        Schema::create('storage_migration_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('storage_migration_id');
            $table->unsignedBigInteger('backup_file_id')->nullable();
            $table->string('source_key');
            $table->string('target_key');
            $table->bigInteger('size')->nullable();
            $table->bigInteger('copied_bytes')->nullable();
            $table->string('checksum')->nullable();
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->text('error')->nullable();
            $table->unsignedSmallInteger('worker_slot')->nullable();
            $table->timestamps();

            $table->unique(['storage_migration_id', 'source_key']);
            $table->index(['storage_migration_id', 'status', 'worker_slot'], 'migration_item_worker_index');
        });

        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn(['database_id', 'database_user_id', 'firewall_rule_id']);
        });
    }
};
