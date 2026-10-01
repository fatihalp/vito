<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('database_upgrades', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id')->index();
            $table->unsignedBigInteger('source_server_id')->index();
            $table->unsignedBigInteger('target_server_id')->nullable()->index();
            $table->unsignedBigInteger('network_id')->nullable();
            $table->boolean('owns_network')->default(false);
            $table->string('source_version')->nullable();
            $table->string('target_version');
            $table->string('username');
            $table->text('password');
            $table->string('status');
            $table->string('step')->nullable();
            $table->text('message')->nullable();
            $table->json('preflight')->nullable();
            $table->json('configuration')->nullable();
            $table->timestamp('caught_up_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_upgrades');
    }
};
