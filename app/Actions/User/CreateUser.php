<?php

namespace App\Actions\User;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CreateUser
{
    
    public function create(array $input): User
    {
        Validator::make($input, [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => [
                'required',
                Rule::in([UserRole::ADMIN, UserRole::USER]),
            ],
            'must_change_password' => ['sometimes', 'boolean'],
        ])->validate();


        $user = User::query()->create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => bcrypt($input['password']),
            'timezone' => 'UTC',
            'is_admin' => $input['role'] === UserRole::ADMIN->value,
            'must_change_password' => (bool) ($input['must_change_password'] ?? true),
        ]);

        return $user;
    }
}
