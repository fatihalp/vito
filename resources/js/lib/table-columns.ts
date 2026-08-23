export function orderTableColumns<T>(columns: T[], getId: (column: T) => string | undefined): T[] {
  return [...columns].sort((left, right) => columnRank(getId(left)) - columnRank(getId(right)));
}

function columnRank(id: string | undefined): number {
  const normalizedId = id?.toLowerCase();

  if (normalizedId === 'actions' || normalizedId === 'options' || normalizedId === 'action') {
    return -100;
  }

  if (normalizedId === 'id') {
    return 1;
  }

  if (normalizedId === 'created_at' || normalizedId === 'updated_at' || normalizedId === 'deleted_at') {
    return 50;
  }

  if (normalizedId === 'warnings' || normalizedId === 'alerts' || normalizedId === 'warning') {
    return 100;
  }

  return 10;
}
