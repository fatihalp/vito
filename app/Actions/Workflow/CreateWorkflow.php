<?php

namespace App\Actions\Workflow;

use App\Models\Project;
use App\Models\User;
use App\Models\Workflow;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class CreateWorkflow
{
    public function create(User $user, Project $project, array $input): Workflow
    {
        Validator::make($input, [
            'name' => ['string', 'max:255'],
            'nodes' => ['nullable', 'array'],
            'edges' => ['nullable', 'array'],
        ])->validate();

        /** @var Workflow $workflow */
        $workflow = $project->workflows()->create([
            'user_id' => $user->id,
            'name' => $input['name'] ?? 'New Workflow',
            'payload' => isset($input['nodes']) ? [
                'nodes' => $input['nodes'],
                'edges' => $input['edges'] ?? [],
            ] : null,
        ]);

        if (isset($input['nodes']) && ! $workflow->getStartingNode()) {
            $workflow->delete();

            throw ValidationException::withMessages([
                'nodes' => 'Starting node not found',
            ]);
        }

        return $workflow;
    }
}
