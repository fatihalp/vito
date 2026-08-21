<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use App\Models\Service;
use App\Services\ServiceInterface;
use Illuminate\Support\Facades\Validator;

class UpdateMetricSettings
{
    
    public function update(Server $server, array $input): void
    {
        $this->validate($input);

        
        $service = $server->monitoring();
        
        $handler = $service->handler();
        $data = $handler->data();
        $data['data_retention'] = $input['data_retention'];
        $service->type_data = $data;
        $service->save();
    }

    private function validate(array $input): void
    {
        Validator::make($input, [
            'data_retention' => [
                'required',
                'numeric',
                'min:1',
            ],
        ])->validate();
    }
}
