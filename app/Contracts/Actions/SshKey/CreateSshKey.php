<?php

namespace App\Contracts\Actions\SshKey;

use App\Models\SshKey;
use App\Models\User;

interface CreateSshKey
{
    public function create(User $user, array $input): SshKey;
}
