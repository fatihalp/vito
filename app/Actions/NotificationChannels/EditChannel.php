<?php

namespace App\Actions\NotificationChannels;

use App\Actions\Projects\GetProjectScope;

use App\Models\NotificationChannel;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

class EditChannel
{
    
    public function edit(NotificationChannel $notificationChannel, User $user, array $input): void
    {
        $this->validate($input);

        $notificationChannel->fill([
            'label' => $input['name'],
            'project_id' => isset($input['global']) && $input['global'] ? null : app(GetProjectScope::class)->projectId($user, $notificationChannel->project_id),
        ]);
        $notificationChannel->save();
    }

    private function validate(array $input): void
    {
        Validator::make($input, [
            'name' => 'required',
        ])->validate();
    }
}
