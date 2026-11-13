<?php

namespace App\Actions\Site;

use App\Events\SiteDeletedEvent;
use App\Models\Site;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeleteSite
{
    public function delete(Site $site, array $input): void
    {
        if ($site->isSelf()) {
            throw ValidationException::withMessages([
                'domain' => __('The Vito application site cannot be deleted.'),
            ]);
        }

        $this->validate($site, $input);

        if ($site->sourceControl && isset($site->type_data['deploy_key_id'])) {
            try {
                $site->sourceControl->provider()->deleteDeployKey(
                    $site->type_data['deploy_key_id'],
                    $site->repository,
                );
            } catch (Throwable $e) {
                Log::warning('Failed to delete deploy key from source control', [
                    'site_id' => $site->id,
                    'exception' => $e->getMessage(),
                ]);
            }
        }

        $iuser = $site->isolatedUser;
        $isLastSibling = ! $site->userSharedWithSiblings();

        $this->deleteRow($site);

        if ($isLastSibling) {
            $iuser?->delete();
        }
    }

    private function deleteRow(Site $site): void
    {
        $server = $site->server;
        $siteId = $site->id;
        $domain = $site->domain;

        $site->delete();

        SiteDeletedEvent::dispatch($server, $siteId, $domain);
    }

    private function validate(Site $site, array $input): void
    {
        Validator::make($input, [
            'domain' => [
                'required',
                Rule::in($site->domain),
            ],
            'force' => [
                'nullable',
                'boolean',
            ],
        ])->validate();
    }
}
