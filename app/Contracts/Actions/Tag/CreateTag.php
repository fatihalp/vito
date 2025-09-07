<?php

namespace App\Contracts\Actions\Tag;

use App\Models\Tag;
use App\Models\User;

interface CreateTag
{
    public function create(User $user, array $input): Tag;
}
