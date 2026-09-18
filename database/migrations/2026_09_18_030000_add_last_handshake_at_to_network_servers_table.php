<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_servers', function (Blueprint $table): void {
            $table->timestamp('last_handshake_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('network_servers', function (Blueprint $table): void {
            $table->dropColumn('last_handshake_at');
        });
    }
};
