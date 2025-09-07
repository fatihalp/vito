<?php

namespace App\Actions\Projects;

use App\Contracts\Actions\Projects\CreateProject as CreateProjectContract;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

class CreateProject implements CreateProjectContract
{
    /**
     * @param  array<string, mixed>  $input
     */
    public function create(User $user, array $input): Project
    {
        $this->validate($input);

        if (isset($input['name'])) {
            $input['name'] = strtolower((string) $input['name']);
        }

        $this->validate($input);

        $project = new Project([
            'name' => $input['name'],
        ]);

        $project->save();

        $project->users()->attach($user);

        return $project;
    }

    private function validate(array $input): void
    {
        $rules = [
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:projects,name',
                'lowercase:projects,name',
            ],
        ];

        Validator::make($input, $rules)->validate();
    }
}
