<?php

namespace App\Contracts\Actions\User;

use App\Models\User;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

interface ResetUserPassword extends ResetsUserPasswords
{
    public function reset(User $user, array $input): void;
}
