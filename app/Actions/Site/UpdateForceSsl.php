<?php

namespace App\Actions\Site;

use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateForceSsl
{
    public function update(Site $site, array $input): bool
    {
        if (! $site->webserver()->canConfigureSSL()) {
            throw ValidationException::withMessages([
                'force_ssl' => __('Force SSL cannot be changed for this webserver.'),
            ]);
        }

        $validated = Validator::make($input, ['enabled' => ['required', 'boolean']])->validate();

        $site->force_ssl = (bool) $validated['enabled'];
        $site->save();
        $site->webserver()->updateVHost($site);

        return $site->force_ssl;
    }
}
