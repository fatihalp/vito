<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_files', function (Blueprint $table): void {
            $table->unsignedBigInteger('database_size')->nullable();
        });

        Schema::create('backup_restores', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('backup_id')->index();
            $table->unsignedBigInteger('backup_file_id')->nullable();
            $table->unsignedBigInteger('server_id')->nullable()->index();
            $table->string('target');
            $table->timestamp('target_time')->nullable();
            $table->string('status');
            $table->string('step')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_restores');

        Schema::table('backup_files', function (Blueprint $table): void {
            $table->dropColumn('database_size');
        });
    }
};
