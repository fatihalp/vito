<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_migration_settings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('max_processes')->default(1);
            $table->unsignedInteger('scan_max_processes')->default(1);
            $table->unsignedInteger('applied_max_processes')->nullable();
            $table->unsignedInteger('applied_scan_max_processes')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_migration_settings');
    }
};
