import { QueryClient } from '@tanstack/react-query'
import { SpotifyApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: (attempt, error) => {
        if (error instanceof SpotifyApiError) {
          // Client-ish errors are real answers, not flaky failures.
          if (error.status >= 400 && error.status < 500) return attempt < 1 && error.status === 429
        }
        return attempt < 2
      }
    },
    mutations: {
      retry: false
    }
  }
})
