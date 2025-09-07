<?php

namespace App\Contracts\Actions\NotificationChannels;

use App\Models\User;

interface AddChannel
{
    public function add(User $user, array $input): void;
}
