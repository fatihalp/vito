<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_migrations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('source_storage_id');
            $table->unsignedBigInteger('target_storage_id');
            $table->unsignedBigInteger('server_id')->nullable();
            $table->unsignedBigInteger('backup_id')->nullable();
            $table->boolean('overwrite')->default(false);
            $table->string('status')->default('pending');
            $table->unsignedInteger('items_total')->default(0);
            $table->unsignedInteger('items_copied')->default(0);
            $table->unsignedInteger('items_skipped')->default(0);
            $table->unsignedInteger('items_failed')->default(0);
            $table->unsignedBigInteger('bytes_total')->default(0);
            $table->unsignedBigInteger('bytes_copied')->default(0);
            $table->string('source_fingerprint')->nullable();
            $table->string('target_fingerprint')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('storage_migration_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('storage_migration_id');
            $table->unsignedBigInteger('backup_file_id');
            $table->string('source_key');
            $table->string('target_key');
            $table->bigInteger('size')->nullable();
            $table->bigInteger('copied_bytes')->nullable();
            $table->string('checksum')->nullable();
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->text('error')->nullable();
            $table->timestamps();

            $table->unique(['storage_migration_id', 'backup_file_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_migration_items');
        Schema::dropIfExists('storage_migrations');
    }
};
