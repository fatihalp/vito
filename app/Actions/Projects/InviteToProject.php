<?php

namespace App\Actions\Projects;

use App\Enums\UserRole;
use App\Mail\ProjectInvitation;
use App\Models\Project;
use App\Models\User;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;
use Throwable;

class InviteToProject
{
    public function invite(Project $project, array $input): void
    {
        $validated = $this->validateSelection($input);
        $user = User::query()->findOrFail($validated['user_id']);

        $this->validateInvitation($project, $user);

        try {
            $project->users()->create([
                'email' => $user->email,
                'role' => UserRole::from($validated['role']),
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'user_id' => __('This user already has access or a pending invitation.'),
            ]);
        }

        try {
            Mail::to($user->email)->send(new ProjectInvitation($project));
        } catch (Throwable) {
            
        }
    }

    
    protected function validateSelection(array $input): array
    {
        return Validator::make($input, [
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
            ],
            'role' => [
                'required',
                Rule::in([
                    UserRole::ADMIN,
                    UserRole::USER,
                ]),
            ],
        ])->validate();
    }

    protected function validateInvitation(Project $project, User $user): void
    {
        Validator::make(['user_id' => $user->id], [
            'user_id' => [
                function (string $attribute, mixed $value, Closure $fail) use ($project, $user): void {
                    if ($project->users()->where(function ($users) use ($user): void {
                        $users->where('user_id', $user->id)->orWhere('email', $user->email);
                    })->exists()) {
                        $fail(__('This user already has access or a pending invitation.'));
                    }
                },
            ],
        ])->validate();
    }
}
