<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runtime_processes', function (Blueprint $table): void {
            $table->string('unix_user', 32)->default('');
        });
        Schema::table('runtime_processes', function (Blueprint $table): void {
            $table->unique(['server_id', 'driver', 'runtime_name', 'unix_user'], 'runtime_processes_context_unique');
            $table->dropUnique(['server_id', 'driver', 'runtime_name']);
        });
    }

    public function down(): void
    {
        if (DB::table('runtime_processes')->where('unix_user', '!=', '')->exists()) {
            throw new RuntimeException('Unlink user-scoped runtime connections before removing their schema.');
        }
        Schema::table('runtime_processes', function (Blueprint $table): void {
            $table->unique(['server_id', 'driver', 'runtime_name']);
            $table->dropUnique('runtime_processes_context_unique');
        });
        Schema::table('runtime_processes', function (Blueprint $table): void {
            $table->dropColumn('unix_user');
        });
    }
};
