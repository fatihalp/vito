<?php

namespace App\Actions\Workflow;

use App\Models\Project;
use App\Models\User;
use App\Models\Workflow;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ImportWorkflow
{
    public function __construct(
        private readonly CreateWorkflow $createWorkflow,
        private readonly UpdateWorkflow $updateWorkflow,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function import(User $user, Project $project, array $input): Workflow
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'nodes' => ['required', 'array'],
            'edges' => ['array'],
        ])->validate();

        return DB::transaction(function () use ($user, $project, $input): Workflow {
            $workflow = $this->createWorkflow->create($user, $project, [
                'name' => $input['name'],
            ]);

            return $this->updateWorkflow->update($workflow, [
                'name' => $input['name'],
                'nodes' => $input['nodes'],
                'edges' => $input['edges'] ?? [],
            ]);
        });
    }
}
