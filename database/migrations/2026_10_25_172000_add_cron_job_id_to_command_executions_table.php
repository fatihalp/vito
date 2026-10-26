<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('command_executions', function (Blueprint $table): void {
            $table->unsignedBigInteger('command_id')->nullable()->change();
            $table->unsignedBigInteger('cron_job_id')->nullable()->after('command_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('command_executions', function (Blueprint $table): void {
            $table->dropColumn('cron_job_id');
            $table->unsignedBigInteger('command_id')->nullable(false)->change();
        });
    }
};
