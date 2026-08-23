<?php

namespace App\Actions\Redirect;

use App\Enums\RedirectStatus;
use App\Jobs\Redirect\CreateJob;
use App\Models\Redirect;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UpdateRedirect
{
    
    public function update(Site $site, Redirect $redirect, array $input): Redirect
    {
        $this->validate($site, $redirect, $input);

        $redirect->from = $input['from'];
        $redirect->to = $input['to'];
        $redirect->mode = $input['mode'];
        $redirect->websocket = ((int) $input['mode'] === Redirect::MODE_PROXY) && ($input['websocket'] ?? false);
        $redirect->status = RedirectStatus::CREATING;
        $redirect->save();

        dispatch(new CreateJob($site, $redirect))->onQueue('ssh');

        return $redirect->refresh();
    }

    
    private function validate(Site $site, Redirect $redirect, array $input): void
    {
        Validator::make($input, CreateRedirect::rules($site, $redirect))->validate();
    }
}
