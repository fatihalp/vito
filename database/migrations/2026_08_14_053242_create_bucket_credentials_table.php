<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    
    public function up(): void
    {
        Schema::create('bucket_credentials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();
            $table->longText('credentials');
            $table->timestamps();
        });
    }

    
    public function down(): void
    {
        Schema::dropIfExists('bucket_credentials');
    }
};
