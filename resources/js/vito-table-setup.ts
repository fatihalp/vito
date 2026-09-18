import { registerCellComponent, registerIcons } from '@forjedio/inertia-table-react';
import { CrownIcon, CopyIcon, SignpostIcon, DatabaseIcon } from 'lucide-react';
import { DatabaseUserDatabases } from '@/components/database-user-databases';
import { ServiceNetworkedBadge } from '@/components/service-networked-badge';
import { ServiceNameCell } from '@/components/service-name-cell';
import { StorageMigrationProgress } from '@/components/storage-migration-progress';

registerIcons({
  crown: CrownIcon,
  copy: CopyIcon,
  signpost: SignpostIcon,
  database: DatabaseIcon,
} as unknown as Parameters<typeof registerIcons>[0]);

registerCellComponent('DatabaseUserDatabases', DatabaseUserDatabases);
registerCellComponent('ServiceNetworkedBadge', ServiceNetworkedBadge);
registerCellComponent('ServiceNameCell', ServiceNameCell);
registerCellComponent('StorageMigrationProgress', StorageMigrationProgress);

