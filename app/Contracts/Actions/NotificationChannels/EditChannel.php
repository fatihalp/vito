<?php

namespace App\Contracts\Actions\NotificationChannels;

use App\Models\NotificationChannel;
use App\Models\User;

interface EditChannel
{
    public function edit(NotificationChannel $notificationChannel, User $user, array $input): void;
}
