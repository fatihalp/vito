<?php

namespace App\Actions\ServerTemplate;

use App\Models\ServerTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

class ManageServerTemplate
{
    public function create(User $user, array $input): ServerTemplate
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'services' => ['required', 'array'],
        ])->validate();

        return $user->serverTemplates()->create($validated);
    }

    public function update(ServerTemplate $template, array $input): void
    {
        $validated = Validator::make($input, [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'services' => ['sometimes', 'required', 'array'],
        ])->validate();

        $template->update($validated);
    }
}
