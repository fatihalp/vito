<?php

namespace App\Helpers;

use App\Models\NotificationChannel;
use App\Notifications\NotificationInterface;

class Notifier
{
    
    public function send(object $notifiable, NotificationInterface $notification): void
    {
        NotificationChannel::notifyAll($notification);
    }
}
