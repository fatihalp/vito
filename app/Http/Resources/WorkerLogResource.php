<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkerLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'worker_id' => $this->worker_id,
            'user_id' => $this->user_id,
            'user_name' => $this->user?->name,
            'user' => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null,
            'type' => $this->type->getText(),
            'type_color' => $this->type->getColor(),
            'description' => $this->description,
            'created_at' => $this->created_at,
        ];
    }
}
