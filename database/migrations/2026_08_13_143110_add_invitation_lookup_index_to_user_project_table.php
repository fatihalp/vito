<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_project', function (Blueprint $table): void {
            $table->index(['email', 'user_id'], 'user_project_invitation_lookup_index');
            $table->unique(['project_id', 'email'], 'user_project_project_email_unique');
            $table->unique(['project_id', 'user_id'], 'user_project_project_user_unique');
        });
    }

    public function down(): void
    {
        Schema::table('user_project', function (Blueprint $table): void {
            $table->dropUnique('user_project_project_email_unique');
            $table->dropUnique('user_project_project_user_unique');
            $table->dropIndex('user_project_invitation_lookup_index');
        });
    }
};
