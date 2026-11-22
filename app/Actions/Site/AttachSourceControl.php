<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\SourceControl;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class AttachSourceControl
{
    public function attach(Site $site, array $input): void
    {
        if ($site->source_control_id) {
            throw ValidationException::withMessages([
                'source_control' => 'This site already has a source control configured.',
            ]);
        }

        Validator::make($input, [
            'source_control' => SourceControl::siteValidationRules($site->server),
            'repository' => ['required', 'string'],
            'branch' => ['required', 'string'],
        ])->validate();

        app(UpdateSourceControl::class)->update($site, $input);
    }
}
