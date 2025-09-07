<?php

namespace App\Contracts\Actions\ServerProvider;

use App\Models\Project;
use App\Models\ServerProvider;

interface EditServerProvider
{
    public function edit(ServerProvider $serverProvider, Project $project, array $input): ServerProvider;
}
