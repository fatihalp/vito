<?php

namespace App\Jobs\HostedDomain;

use App\Actions\HostedDomain\ActivateHostedDomain;
use App\Actions\HostedDomain\VerifyHostedDomain;
use App\DTOs\SocketEventDTO;
use App\Enums\HostedDomainStatus;
use App\Events\SocketEvent;
use App\Http\Resources\HostedDomainResource;
use App\Models\HostedDomain;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Throwable;

class CheckDomainJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected HostedDomain $hostedDomain) {}

    public function handle(VerifyHostedDomain $verifier, ActivateHostedDomain $activator): void
    {
        $this->run("hosted-domain-check-{$this->hostedDomain->id}", function () use ($verifier, $activator): void {
            $result = $verifier->verify($this->hostedDomain);

            if ($result->verified) {
                $this->hostedDomain->error = null;
                $this->hostedDomain->save();
                $activator->activate($this->hostedDomain);
            } else {
                $this->hostedDomain->status = HostedDomainStatus::PENDING;
                $this->hostedDomain->error = $result->failureReason;
                $this->hostedDomain->save();
            }

            $this->broadcastUpdate();
        });
    }

    public function failed(Throwable $e): void
    {
        $domain = HostedDomain::query()->find($this->hostedDomain->id);

        if ($domain?->status->isProcessing()) {
            $domain->update(['status' => HostedDomainStatus::PENDING, 'error' => Str::limit($e->getMessage(), 1000)]);
            $this->broadcastUpdate();
        }
    }

    private function broadcastUpdate(): void
    {
        $this->hostedDomain->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->hostedDomain->site->server->project_id,
            type: 'hosted-domain.updated',
            data: new HostedDomainResource($this->hostedDomain),
        ));
    }
}
