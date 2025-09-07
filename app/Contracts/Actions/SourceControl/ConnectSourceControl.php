<?php

namespace App\Contracts\Actions\SourceControl;

use App\Models\Project;
use App\Models\SourceControl;

interface ConnectSourceControl
{
    public function connect(Project $project, array $input): SourceControl;
}
