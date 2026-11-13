<?php

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_project', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('project_id');
            $table->timestamps();
        });
        Model::withoutEvents(function (): void {
            Project::withoutGlobalScopes()->select(['id', 'user_id'])->each(function (Project $project): void {
                if ($project->user_id && User::withoutGlobalScopes()->whereKey($project->user_id)->exists()) {
                    $project->users()->firstOrCreate(['user_id' => $project->user_id]);
                }
            });

            User::withoutGlobalScopes()->select('id')->each(function (User $user): void {
                $projectId = $user->projectMemberships()->orderBy('id')->value('project_id');

                if (! $projectId) {
                    $project = new Project;
                    $project->forceFill(['user_id' => $user->id, 'name' => 'default'])->save();
                    $project->users()->create(['user_id' => $user->id]);
                    $projectId = $project->id;
                }

                $user->forceFill(['current_project_id' => $projectId])->save();
            });
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_project');
    }
};
