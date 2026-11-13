<?php

use App\Models\User;
use App\Models\Project;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedBigInteger('current_project_id')->nullable()->after('timezone');
        });
        User::withoutGlobalScopes()->each(function (User $user): void {
            $project = Project::withoutGlobalScopes()->where('user_id', $user->id)->first();
            if (! $project) {
                $project = new Project;
                $project->forceFill(['user_id' => $user->id, 'name' => 'default'])->save();
            }
            $user->forceFill(['current_project_id' => $project->id])->save();
            $user->servers()->withoutGlobalScopes()->update(['project_id' => $project->id]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('current_project_id');
        });
    }
};
