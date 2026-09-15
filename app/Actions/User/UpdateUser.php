<?php

namespace App\Actions\User;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UpdateUser
{
    
    public function update(User $user, array $input): User
    {
        $this->validate($user, $input);

        $user->name = $input['name'];
        $user->email = $input['email'];
        $user->is_admin = $input['role'] === UserRole::ADMIN->value;

        if (isset($input['password'])) {
            $user->password = bcrypt($input['password']);
        }

        if (isset($input['must_change_password'])) {
            $user->must_change_password = (bool) $input['must_change_password'];
        }

        $user->save();

        return $user;
    }

    
    private function validate(User $user, array $input): void
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email', 'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'role' => [
                'required',
                Rule::in([UserRole::ADMIN, UserRole::USER]),
            ],
            'must_change_password' => ['sometimes', 'boolean'],
        ])->validate();
    }
}
