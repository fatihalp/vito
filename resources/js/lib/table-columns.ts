export function orderTableColumns<T>(columns: T[], getId: (column: T) => string | undefined): T[] {
  return [...columns].sort((left, right) => columnRank(getId(left)) - columnRank(getId(right)));
}

function columnRank(id: string | undefined): number {
  const normalizedId = id?.toLowerCase();

  if (normalizedId === 'actions' || normalizedId === 'options') {
    return -1;
  }

  if (normalizedId === 'id') {
    return 1;
  }

  return 0;
}
