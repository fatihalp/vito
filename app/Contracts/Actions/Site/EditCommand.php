<?php

namespace App\Contracts\Actions\Site;

use App\Models\Command;

interface EditCommand
{
    public function edit(Command $command, array $input): Command;
}
