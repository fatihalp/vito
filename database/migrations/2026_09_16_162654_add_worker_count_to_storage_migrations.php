<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->unsignedSmallInteger('worker_count')->default(1);
        });
        Schema::table('storage_migration_items', function (Blueprint $table): void {
            $table->unsignedSmallInteger('worker_slot')->nullable();
            $table->index(['storage_migration_id', 'status', 'worker_slot'], 'migration_item_worker_index');
        });
    }

    public function down(): void
    {
        Schema::table('storage_migration_items', function (Blueprint $table): void {
            $table->dropIndex('migration_item_worker_index');
            $table->dropColumn('worker_slot');
        });
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn('worker_count');
        });
    }
};
