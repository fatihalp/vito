<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Models\UserProject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_admin' => $this->is_admin,
            'must_change_password' => (bool) $this->must_change_password,
            'two_factor_enabled' => (bool) $this->two_factor_secret,
            'last_login_at' => $this->last_login_at,
            'last_activity_at' => $this->last_activity_at,
            $this->mergeWhen($request->user()?->can('viewAny', User::class) ?? false, [
                'password_changed_at' => $this->password_changed_at,
                'last_login_browser' => $this->last_login_browser,
                'last_login_language' => $this->last_login_language,
                'last_login_user_agent' => $this->last_login_user_agent,
                'project_access' => $this->whenLoaded('projectMemberships', fn () => $this->projectMemberships->map(fn (UserProject $membership): array => [
                    'project_id' => $membership->project_id,
                    'name' => $membership->project?->name,
                    'role' => $membership->role->getText(),
                    'role_color' => $membership->role->getColor(),
                ])),
            ]),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'projects' => ProjectResource::collection($this->whenLoaded('projects')),
        ];
    }
}
