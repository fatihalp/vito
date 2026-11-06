<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('runtime_processes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('label', 160);
            $table->string('driver', 20);
            $table->string('runtime_name', 128);
            $table->string('kind', 20);
            $table->string('status', 20)->default('unknown');
            $table->json('details')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
            $table->unique(['server_id', 'driver', 'runtime_name']);
        });
        Schema::create('runtime_process_site', function (Blueprint $table): void {
            $table->foreignId('runtime_process_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->index()->constrained()->cascadeOnDelete();
            $table->primary(['runtime_process_id', 'site_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('runtime_process_site');
        Schema::dropIfExists('runtime_processes');
    }
};
