<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table): void {
            $table->string('process_name')->nullable()->index();
        });

        DB::table('workers')
            ->whereNull('process_name')
            ->get(['id'])
            ->each(fn (object $worker) => DB::table('workers')
                ->where('id', $worker->id)
                ->update(['process_name' => (string) $worker->id]));
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table): void {
            $table->dropColumn('process_name');
        });
    }
};
