import { useInfiniteQuery } from '@tanstack/react-query'
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query'

export interface PagedResult<T> {
  items: T[]
  total: number
}

export type PagedFetcher<T> = (offset: number, limit: number) => Promise<PagedResult<T>>

/** Standard offset-paged infinite list for library/search collections. */
export function useInfiniteList<T>(key: unknown[], fetcher: PagedFetcher<T>, limit = 50) {
  const query = useInfiniteQuery({
    queryKey: [...key, 'paged', limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetcher(Number(pageParam), limit),
    getNextPageParam: (last, pages) => (pages.length * limit < last.total ? pages.length * limit : undefined)
  }) as UseInfiniteQueryResult<InfiniteData<PagedResult<T>, number>, Error>

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.total ?? query.data?.pages.at(-1)?.total ?? 0

  return {
    items,
    total,
    loading: query.isLoading,
    error: query.error as unknown,
    fetchMore: query.fetchNextPage,
    canFetchMore: Boolean(query.hasNextPage),
    refetch: query.refetch
  }
}
