<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->timestamp('scan_completed_at')->nullable()->after('started_at');
        });
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn('scan_completed_at');
        });
    }
};
