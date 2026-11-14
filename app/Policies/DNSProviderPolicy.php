<?php

namespace App\Policies;

use App\Models\DNSProvider;
use App\Models\User;

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
        return $this->update($user, $dnsProvider);
    }

    
    public function delete(User $user, DNSProvider $dnsProvider): bool
    {
        return $user->id === $dnsProvider->user_id;
    }
}
