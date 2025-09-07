<?php

namespace App\Actions\NotificationChannels;

use App\Contracts\Actions\NotificationChannels\EditChannel as EditChannelContract;
use App\Models\NotificationChannel;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

class EditChannel implements EditChannelContract
{
    /**
     * @param  array<string, mixed>  $input
     */
    public function edit(NotificationChannel $notificationChannel, User $user, array $input): void
    {
        $this->validate($input);

        $notificationChannel->fill([
            'label' => $input['name'],
            'project_id' => isset($input['global']) && $input['global'] ? null : $user->current_project_id,
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
