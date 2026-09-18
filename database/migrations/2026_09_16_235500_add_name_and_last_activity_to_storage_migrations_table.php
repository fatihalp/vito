<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->string('name')->nullable();
            $table->timestamp('last_activity_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn(['name', 'last_activity_at']);
        });
    }
};
