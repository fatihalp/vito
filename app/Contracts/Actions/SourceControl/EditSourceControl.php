<?php

namespace App\Contracts\Actions\SourceControl;

use App\Models\Project;
use App\Models\SourceControl;

interface EditSourceControl
{
    public function edit(SourceControl $sourceControl, Project $project, array $input): SourceControl;
}
