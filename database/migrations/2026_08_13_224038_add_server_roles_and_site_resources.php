<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table): void {
            $table->string('role')->default('app')->after('name')->index();
        });

        Schema::create('site_resources', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('server_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('storage_provider_id')->nullable()->constrained('storage_providers')->cascadeOnDelete();
            $table->string('type');
            $table->string('status')->default('connecting');
            $table->text('configuration')->nullable();
            $table->text('environment');
            $table->text('original_environment')->nullable();
            $table->timestamps();
            $table->unique(['site_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_resources');

        Schema::table('servers', function (Blueprint $table): void {
            $table->dropColumn('role');
        });
    }
};
