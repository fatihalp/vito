<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->text('target_cursor')->nullable();
            $table->timestamp('target_scan_completed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn(['target_cursor', 'target_scan_completed_at']);
        });
    }
};
