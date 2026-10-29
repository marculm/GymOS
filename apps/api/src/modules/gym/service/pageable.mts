import { appConfig } from "../../../config/app.mts";

export type Pageable = {
  readonly number: number;
  readonly size: number;
};

export function createPageable({ page, size }: { page?: number; size?: number }): Pageable {
  const validPage = page !== undefined && Number.isInteger(page) && page >= 1;
  const validSize =
    size !== undefined &&
    Number.isInteger(size) &&
    size >= 1 &&
    size <= appConfig.pagination.maxSize;

  return {
    number: validPage ? page - 1 : 0,
    size: validSize ? size : appConfig.pagination.defaultSize,
  };
}

export function skipTake(pageable: Pageable) {
  return {
    skip: pageable.number * pageable.size,
    take: pageable.size,
  };
}
