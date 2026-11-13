export function formatWeight(weightKg: number): string {
  return String(Number(weightKg.toFixed(2)));
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
