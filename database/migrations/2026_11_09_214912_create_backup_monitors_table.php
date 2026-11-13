<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_monitors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_server_id')->nullable()->constrained('servers')->nullOnDelete();
            $table->string('label', 160);
            $table->text('configuration');
            $table->string('status')->default('unknown');
            $table->json('details')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->string('last_alert_status')->nullable();
            $table->timestamp('last_alert_requested_at')->nullable();
            $table->string('last_task')->nullable();
            $table->string('task_state')->nullable();
            $table->timestamp('task_requested_at')->nullable();
            $table->timestamps();
            $table->unique(['server_id', 'label']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_monitors');
    }
};
