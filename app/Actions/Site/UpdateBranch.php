<?php

namespace App\Actions\Site;

use App\Exceptions\SSHError;
use App\Models\Site;
use App\SSH\OS\Git;
use Illuminate\Support\Facades\Validator;

class UpdateBranch
{
    
    public function update(Site $site, array $input): void
    {
        Validator::make($input, [
            'branch' => 'required',
        ])->validate();

        $site->branch = $input['branch'];
        $path = $site->modernDeploymentEnabled() ? $site->basePath().'/source' : null;
        app(Git::class)->fetchOrigin($site, path: $path);
        app(Git::class)->checkout($site, path: $path);
        $site->save();
    }
}
