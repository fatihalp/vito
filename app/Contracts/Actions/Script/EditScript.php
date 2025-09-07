<?php

namespace App\Contracts\Actions\Script;

use App\Models\Script;
use App\Models\User;

interface EditScript
{
    public function edit(Script $script, User $user, array $input): Script;
}
