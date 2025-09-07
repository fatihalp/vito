<?php

namespace App\Contracts\Actions\User;

use App\Models\User;

interface CreateUser
{
    public function create(array $input): User;
}
