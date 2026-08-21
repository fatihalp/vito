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

        Schema::create('buckets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('driver')->default('s3');
            $table->text('configuration');
            $table->timestamps();
            $table->unique(['project_id', 'name']);
        });

        Schema::create('site_resources', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('server_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('bucket_id')->nullable()->constrained()->cascadeOnDelete();
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
        Schema::dropIfExists('buckets');

        Schema::table('servers', function (Blueprint $table): void {
            $table->dropColumn('role');
        });
    }
};
