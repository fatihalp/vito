<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->nullable()->after('site_id');
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('worker_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('worker_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('type');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['worker_id', 'created_at']);
            $table->foreign('worker_id')->references('id')->on('workers')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_logs');

        Schema::table('workers', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id']);
        });
    }
};
