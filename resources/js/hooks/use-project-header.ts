import { useEffect } from 'react';
import { http } from '@inertiajs/react';
import axios from 'axios';

const PROJECT_HEADER = 'X-Vito-Project';

export function useProjectHeader(projectId?: number) {
  useEffect(() => {
    if (!projectId) return;

    const value = String(projectId);
    axios.defaults.headers.common[PROJECT_HEADER] = value;
    const removeHandler = http.onRequest((config) => ({ ...config, headers: { ...config.headers, [PROJECT_HEADER]: value } }));

    return () => {
      removeHandler();
      delete axios.defaults.headers.common[PROJECT_HEADER];
    };
  }, [projectId]);
}
