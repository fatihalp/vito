<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use App\Models\UserProject;
use Illuminate\Database\Eloquent\Model;
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

        Model::withoutEvents(function (): void {
            $admins = User::withoutGlobalScopes()->where('is_admin', true)->get(['id', 'email']);

            Project::withoutGlobalScopes()->select('id')->each(function (Project $project) use ($admins): void {
                foreach ($admins as $admin) {
                    $project->users()->updateOrCreate(
                        ['user_id' => $admin->id],
                        ['email' => $admin->email, 'role' => UserRole::OWNER],
                    );
                }

                $project->users()->with(['user' => fn ($query) => $query->withoutGlobalScopes()->select(['id', 'email', 'is_admin'])])->whereNotNull('user_id')
                    ->each(function (UserProject $membership): void {
                        $membership->forceFill([
                            'email' => $membership->user?->email,
                            'role' => $membership->user?->is_admin ? UserRole::OWNER : UserRole::USER,
                        ])->save();
                    });
            });
        });
    }

    public function down(): void {}
};
