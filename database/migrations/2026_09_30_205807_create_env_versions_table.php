<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('env_versions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('site_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('restored_from_id')->nullable();
            $table->string('path');
            $table->longText('content');
            $table->string('source');
            $table->timestamps();

            $table->index(['site_id', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('env_versions');
    }
};
