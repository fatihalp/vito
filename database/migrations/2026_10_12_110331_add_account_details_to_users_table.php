<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('password_changed_at')->nullable();
            $table->string('last_login_browser')->nullable();
            $table->string('last_login_language', 100)->nullable();
            $table->text('last_login_user_agent')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['password_changed_at', 'last_login_browser', 'last_login_language', 'last_login_user_agent']);
        });
    }
};
