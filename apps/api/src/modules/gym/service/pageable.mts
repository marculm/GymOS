import { appConfig } from "../../../config/app.mts";

export type Pageable = {
  readonly number: number;
  readonly size: number;
};

export function createPageable({ page, size }: { page?: number; size?: number }): Pageable {
  const number = Math.max(1, page ?? 1) - 1;
  const normalizedSize = Math.min(
    appConfig.pagination.maxSize,
    Math.max(1, size ?? appConfig.pagination.defaultSize)
  );
  return { number, size: normalizedSize };
}

export function skipTake(pageable: Pageable) {
  return {
    skip: pageable.number * pageable.size,
    take: pageable.size,
  };
}
