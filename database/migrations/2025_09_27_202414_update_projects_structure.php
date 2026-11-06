<?php

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

        Schema::table('user_project', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->string('email')->after('id')->nullable();
            $table->string('role')->after('project_id')->default('user');
        });

        $now = now();
        $admins = DB::table('users')->where('is_admin', true)->get(['id', 'email']);

        DB::table('projects')->orderBy('id')->each(function (object $project) use ($admins, $now): void {
            foreach ($admins as $admin) {
                DB::table('user_project')->updateOrInsert(
                    ['user_id' => $admin->id, 'project_id' => $project->id],
                    ['email' => $admin->email, 'role' => 'owner', 'created_at' => $now, 'updated_at' => $now],
                );
            }

            DB::table('user_project as membership')
                ->leftJoin('users', 'users.id', '=', 'membership.user_id')
                ->where('membership.project_id', $project->id)
                ->whereNotNull('membership.user_id')
                ->orderBy('membership.id')
                ->select(['membership.id', 'users.email', 'users.is_admin'])
                ->each(function (object $membership): void {
                    DB::table('user_project')->where('id', $membership->id)->update([
                        'email' => $membership->email,
                        'role' => $membership->is_admin ? 'owner' : 'user',
                    ]);
                });
        });
    }

    public function down(): void {}
};
