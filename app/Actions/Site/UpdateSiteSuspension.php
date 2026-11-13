<?php

namespace App\Actions\Site;

use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateSiteSuspension
{
    public function update(Site $site, array $input): bool
    {
        $validated = Validator::make($input, ['suspended' => ['required', 'boolean']])->validate();

        if ($site->isSelf()) {
            throw ValidationException::withMessages([
                'suspended' => __('The Vito application site cannot be suspended.'),
            ]);
        }

        if (! $site->vhost_generation_enabled) {
            throw ValidationException::withMessages([
                'suspended' => __('Re-enable VHost generation before changing the suspension of this site.'),
            ]);
        }

        $site->suspended_at = $validated['suspended'] ? now() : null;
        $site->webserver()->updateVHost($site);
        $site->save();

        app(BroadcastSiteUpdate::class)->broadcast($site);

        return $site->isSuspended();
    }
}
