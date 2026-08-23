<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_resources', function (Blueprint $table): void {
            if (Schema::hasColumn('site_resources', 'bucket_id') && ! Schema::hasColumn('site_resources', 'storage_provider_id')) {
                $table->renameColumn('bucket_id', 'storage_provider_id');
            } elseif (! Schema::hasColumn('site_resources', 'storage_provider_id')) {
                $table->foreignId('storage_provider_id')->nullable()->after('server_id')->constrained('storage_providers')->cascadeOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('site_resources', function (Blueprint $table): void {
            if (Schema::hasColumn('site_resources', 'storage_provider_id') && ! Schema::hasColumn('site_resources', 'bucket_id')) {
                $table->renameColumn('storage_provider_id', 'bucket_id');
            }
        });
    }
};
