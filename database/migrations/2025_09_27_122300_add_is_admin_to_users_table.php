<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS plugins_is_enabled_priority_index');
        }

        $admins = User::withoutGlobalScopes()->where('role', UserRole::ADMIN)->pluck('id');
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('password');
            $table->dropColumn('role');
        });
        User::withoutGlobalScopes()->whereIn('id', $admins)->update(['is_admin' => true]);
    }

    
    public function down(): void
    {
        $admins = User::withoutGlobalScopes()->where('is_admin', true)->pluck('id');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
            $table->string('role')->default(UserRole::USER)->after('password');
        });
        User::withoutGlobalScopes()->whereIn('id', $admins)->update(['role' => UserRole::ADMIN]);
    }
};
