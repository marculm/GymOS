export function nextRotationPlanId(
  planIds: string[],
  lastPlanId: string | null
): string | null {
  if (planIds.length === 0) return null;

  const lastIndex = lastPlanId === null ? -1 : planIds.indexOf(lastPlanId);
  const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % planIds.length;
  return planIds[nextIndex] ?? null;
}
