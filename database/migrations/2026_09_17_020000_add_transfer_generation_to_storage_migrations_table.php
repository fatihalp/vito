<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->unsignedInteger('transfer_generation')->default(0)->after('worker_count');
        });
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn('transfer_generation');
        });
    }
};
