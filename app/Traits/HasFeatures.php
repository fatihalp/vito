<?php

namespace App\Traits;

trait HasFeatures
{
    
    abstract public function featuresConfig(): array;

    
    public function features(): array
    {
        $features = $this->featuresConfig();
        foreach ($features as $featureKey => $feature) {
            foreach ($feature['actions'] ?? [] as $actionKey => $action) {
                $handlerClass = $action['handler'] ?? null;
                if ($handlerClass && class_exists($handlerClass)) {
                    $handler = new $handlerClass($this);
                    $action['active'] = $handler->active();
                    if (! isset($action['form']) || empty($action['form'])) {
                        $action['form'] = $handler->form()?->toArray() ?? [];
                    }
                }
                $features[$featureKey]['actions'][$actionKey] = $action;
            }
        }

        return $features;
    }

    
    public function hasFeature(string $feature): bool
    {
        return array_key_exists($feature, $this->featuresConfig());
    }
}
