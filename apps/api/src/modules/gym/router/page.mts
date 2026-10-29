import type { Pageable } from "../service/pageable.mts";
import type { Slice } from "../service/slice.mts";

export type Page<T> = {
  readonly content: T[];
  readonly page: {
    readonly size: number;
    readonly number: number;
    readonly totalElements: number;
    readonly totalPages: number;
  };
};

export function createPage<T>(slice: Slice<T>, pageable: Pageable): Page<T> {
  const { content, totalElements } = slice;
  const { size, number } = pageable;
  return {
    content,
    page: {
      size,
      number,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    },
  };
}
