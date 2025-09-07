<?php

namespace App\Actions\Site;

use App\Contracts\Actions\Site\UpdatePHPVersion as UpdatePHPVersionContract;
use App\Exceptions\SSHError;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UpdatePHPVersion implements UpdatePHPVersionContract
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws SSHError
     */
    public function update(Site $site, array $input): void
    {
        Validator::make($input, [
            'version' => [
                'required',
                Rule::exists('services', 'version')
                    ->where('server_id', $site->server_id)
                    ->where('type', 'php'),
            ],
        ])->validate();

        $site->changePHPVersion($input['version']);
    }
}
