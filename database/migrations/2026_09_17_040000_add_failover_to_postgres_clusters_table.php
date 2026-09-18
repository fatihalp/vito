<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('postgres_clusters', function (Blueprint $table): void {
            $table->text('failover')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('postgres_clusters', function (Blueprint $table): void {
            $table->dropColumn('failover');
        });
    }
};
