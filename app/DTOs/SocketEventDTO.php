<?php

namespace App\DTOs;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final readonly class SocketEventDTO
{
    
    public array $data;

    
    public function __construct(
        public int $projectId,
        public string $type,
        array|JsonResource $data,
    ) {
        $this->data = $data instanceof JsonResource
            ? $data->toArray(new Request)
            : $data;
    }

    
    public function toArray(): array
    {
        return [
            'project_id' => $this->projectId,
            'type' => $this->type,
            'data' => $this->data,
        ];
    }
}
