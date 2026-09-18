<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn(['server_id', 'backup_id']);
        });
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->unsignedBigInteger('server_id')->nullable();
            $table->unsignedBigInteger('backup_id')->nullable();
        });
    }
};
