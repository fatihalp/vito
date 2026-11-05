<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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
        $now = now();

        DB::table('projects')->orderBy('id')->each(function (object $project) use ($now): void {
            if (! $project->user_id || ! DB::table('users')->whereKey($project->user_id)->exists()) {
                return;
            }

            DB::table('user_project')->updateOrInsert(
                ['user_id' => $project->user_id, 'project_id' => $project->id],
                ['role' => 'owner', 'created_at' => $now, 'updated_at' => $now],
            );
        });

        DB::table('users')->orderBy('id')->each(function (object $user) use ($now): void {
            $projectId = DB::table('user_project')
                ->where('user_id', $user->id)
                ->value('project_id');

            if (! $projectId) {
                $projectId = DB::table('projects')->insertGetId([
                    'user_id' => $user->id,
                    'name' => 'default',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('user_project')->insert([
                    'user_id' => $user->id,
                    'project_id' => $projectId,
                    'role' => 'owner',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('users')->whereKey($user->id)->update(['current_project_id' => $projectId]);
        });
    }

    
    public function down(): void
    {
        Schema::dropIfExists('user_project');
    }
};
