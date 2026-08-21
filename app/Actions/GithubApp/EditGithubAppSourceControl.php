<?php

namespace App\Actions\GithubApp;

use App\Models\SourceControl;

class EditGithubAppSourceControl
{
    
    public function edit(SourceControl $sourceControl, array $input): SourceControl
    {
        $sourceControl->project_id = isset($input['global']) && $input['global']
            ? null
            : $sourceControl->user->currentProject?->id;

        $sourceControl->save();

        return $sourceControl;
    }
}
