<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployments', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('trigger')->nullable();
            $table->unsignedBigInteger('rolled_back_by_id')->nullable();
            $table->timestamp('rolled_back_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('deployments', function (Blueprint $table): void {
            $table->dropColumn(['user_id', 'trigger', 'rolled_back_by_id', 'rolled_back_at']);
        });
    }
};
