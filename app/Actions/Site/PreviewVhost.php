<?php

namespace App\Actions\Site;

use App\Models\Site;

class PreviewVhost
{
    
    public function preview(Site $site, array $input): string
    {
        $validated = validator($input, [
            'template' => ['required', 'string', 'max:65535'],
        ])->validate();

        return $site->webserver()->generateVhost($site, $validated['template']);
    }
}
