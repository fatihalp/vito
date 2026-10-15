<?php

namespace App\Actions\User;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use App\Models\UserProject;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UpdateUser
{
    public function update(User $user, array $input): User
    {
        $this->validate($user, $input);

        return DB::transaction(function () use ($user, $input): User {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $user->name = $input['name'];
            $user->email = $input['email'];
            $user->is_admin = $input['role'] === UserRole::ADMIN->value;

            if (isset($input['password'])) {
                $user->password = bcrypt($input['password']);
            }

            if (isset($input['must_change_password'])) {
                $user->must_change_password = (bool) $input['must_change_password'];
            }

            if (array_key_exists('project_access', $input)) {
                $this->updateProjectAccess($user, $input['project_access']);
            }

            $user->save();

            return $user;
        });
    }

    /** @param array<int, array{project_id: int, role: string}> $access */
    private function updateProjectAccess(User $user, array $access): void
    {
        $selected = collect($access)->keyBy('project_id');
        $memberships = $user->projectMemberships()->get();
        $projects = Project::query()->whereIn('id', $selected->keys()->merge($memberships->pluck('project_id'))->unique())
            ->orderBy('id')->lockForUpdate()->get(['id', 'name'])->keyBy('id');

        foreach ($memberships as $membership) {
            if ($membership->role === UserRole::OWNER && ($selected->get($membership->project_id)['role'] ?? null) !== UserRole::OWNER->value) {
                $hasAnotherOwner = UserProject::query()->where('project_id', $membership->project_id)
                    ->whereNotNull('user_id')->where('user_id', '!=', $user->id)->where('role', UserRole::OWNER)
                    ->lockForUpdate()->first(['id']) !== null;
                if (! $hasAnotherOwner) {
                    throw ValidationException::withMessages(['project_access' => 'Assign another owner to '.($projects->get($membership->project_id)?->name ?? 'this project').' before removing or changing its last owner.']);
                }
            }
        }

        $user->projectMemberships()->whereNotIn('project_id', $selected->keys())->delete();
        foreach ($access as $membership) {
            $user->projectMemberships()->updateOrCreate(['project_id' => $membership['project_id']], ['role' => $membership['role']]);
        }

        if (! $selected->has($user->current_project_id)) {
            $user->current_project_id = $selected->keys()->first();
        }
    }

    private function validate(User $user, array $input): void
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in([UserRole::ADMIN, UserRole::USER])],
            'must_change_password' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', Password::defaults()],
            'project_access' => ['sometimes', 'array'],
            'project_access.*.project_id' => ['required', 'integer', 'distinct', Rule::exists(Project::class, 'id')],
            'project_access.*.role' => ['required', Rule::in([UserRole::OWNER, UserRole::ADMIN, UserRole::USER])],
        ])->validate();
    }
}
