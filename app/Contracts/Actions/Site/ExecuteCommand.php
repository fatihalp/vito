<?php

namespace App\Contracts\Actions\Site;

use App\Models\Command;
use App\Models\CommandExecution;
use App\Models\User;

interface ExecuteCommand
{
    public function execute(Command $command, User $user, array $input): CommandExecution;
}
