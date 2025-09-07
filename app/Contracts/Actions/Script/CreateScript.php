<?php

namespace App\Contracts\Actions\Script;

use App\Models\Script;
use App\Models\User;

interface CreateScript
{
    public function create(User $user, array $input): Script;
}
