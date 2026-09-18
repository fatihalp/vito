<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->boolean('scan_paused')->default(false);
            $table->boolean('transfer_paused')->default(false);
            $table->text('scan_cursor')->nullable();
        });

        DB::table('storage_migrations')->where('status', 'paused')->update([
            'scan_paused' => true,
            'transfer_paused' => true,
        ]);
    }

    public function down(): void
    {
        Schema::table('storage_migrations', function (Blueprint $table): void {
            $table->dropColumn(['scan_paused', 'transfer_paused', 'scan_cursor']);
        });
    }
};
