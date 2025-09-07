<?php

namespace App\Contracts\Actions\User;

use App\Models\User;

interface UpdateProjects
{
    public function update(User $user, array $input): void;
}
