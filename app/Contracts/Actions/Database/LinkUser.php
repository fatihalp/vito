<?php

namespace App\Contracts\Actions\Database;

use App\Models\DatabaseUser;

interface LinkUser
{
    public function link(DatabaseUser $databaseUser, array $input): DatabaseUser;
}
