<?php

namespace App\Contracts\Actions\User;

use App\Models\User;

interface UpdateUser
{
    public function update(User $user, array $input): User;
}
