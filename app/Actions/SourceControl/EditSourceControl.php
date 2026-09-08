<?php

namespace App\Actions\SourceControl;

use App\Actions\GithubApp\EditGithubAppSourceControl;
use App\Models\SourceControl;
use Illuminate\Support\Facades\Validator;

class EditSourceControl
{
    
    public function edit(SourceControl $sourceControl, array $input): SourceControl
    {
        if ($sourceControl->isGithubApp()) {
            return app(EditGithubAppSourceControl::class)->edit($sourceControl, $input);
        }

        Validator::make($input, array_merge(
            ['name' => ['required']],
            $sourceControl->provider()->editRules($input),
        ))->validate();

        $sourceControl->profile = $input['name'];
        $sourceControl->project_id = isset($input['global']) && $input['global']
            ? null
            : $sourceControl->user->currentProject?->id;
        $sourceControl->provider_data = $sourceControl->provider()->editData($input);

        $sourceControl->save();

        return $sourceControl;
    }
}
