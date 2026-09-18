<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migration_items', function (Blueprint $table): void {
            $table->dropUnique(['storage_migration_id', 'backup_file_id']);
            $table->unique(['storage_migration_id', 'source_key']);
        });
    }

    public function down(): void
    {
        Schema::table('storage_migration_items', function (Blueprint $table): void {
            $table->dropUnique(['storage_migration_id', 'source_key']);
            $table->unique(['storage_migration_id', 'backup_file_id']);
        });
    }
};
