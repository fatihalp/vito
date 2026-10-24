<?php

namespace App\Actions\Site;

use App\Models\Site;
use Illuminate\Support\Facades\Validator;

class UpdateVhostTemplate
{
    public function update(Site $site, array $input): void
    {
        $validated = Validator::make($input, [
            'template' => ['required', 'string', 'max:65535'],
        ])->validate();

        $this->apply($site, rtrim($validated['template']) === rtrim($site->webserver()->defaultVhostTemplate()) ? null : $validated['template']);
    }

    public function reset(Site $site): void
    {
        $this->apply($site, null);
    }

    private function apply(Site $site, ?string $template): void
    {
        $site->vhost_template = $template;
        $site->save();

        $site->webserver()->updateVHost($site);
    }
}
