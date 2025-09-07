<?php

namespace App\Actions\Site;

use App\Contracts\Actions\Site\UpdateBranch as UpdateBranchContract;
use App\Exceptions\SSHError;
use App\Models\Site;
use App\SSH\OS\Git;
use Illuminate\Support\Facades\Validator;

class UpdateBranch implements UpdateBranchContract
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws SSHError
     */
    public function update(Site $site, array $input): void
    {
        Validator::make($input, [
            'branch' => 'required',
        ])->validate();

        $site->branch = $input['branch'];
        app(Git::class)->fetchOrigin($site);
        app(Git::class)->checkout($site);
        $site->save();
    }
}
