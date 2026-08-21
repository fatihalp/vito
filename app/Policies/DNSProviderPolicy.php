<?php

namespace App\Policies;

use App\Models\DNSProvider;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Laravel\Sanctum\TransientToken;

class DNSProviderPolicy
{
    
    public function viewAny(User $user): bool
    {
        return true;
    }

    
    public function view(User $user, DNSProvider $dnsProvider): bool
    {
        return $user->id === $dnsProvider->user_id;
    }

    
    public function create(User $user): bool
    {
        return true;
    }

    
    public function update(User $user, DNSProvider $dnsProvider): bool
    {
        return $user->id === $dnsProvider->user_id;
    }

    
    public function revealCredentials(User $user, DNSProvider $dnsProvider): bool
    {
        
        $token = $user->currentAccessToken();

        if ($token !== null && ! $token->can('write')) {
            return false;
        }

        return $this->update($user, $dnsProvider);
    }

    
    public function delete(User $user, DNSProvider $dnsProvider): bool
    {
        return $user->id === $dnsProvider->user_id;
    }
}
