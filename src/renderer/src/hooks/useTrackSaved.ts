import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/**
 * `preset` avoids firing a contains-request per row when the answer is implied
 * by the list ('saved' for the Liked-songs view; 'lookup' queries the API).
 */
export type SavedPreset = 'saved' | 'none' | 'lookup'

export function useTrackSaved(uri: string | null | undefined, preset: SavedPreset = 'lookup') {
  const queryClient = useQueryClient()
  const key = ['saved-contains', uri ?? '']

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await api.containsUris([uri as string]))[0] ?? false,
    enabled: Boolean(uri) && preset === 'lookup',
    staleTime: 60_000
  })

  const stored = preset === 'saved' ? true : preset === 'none' ? false : Boolean(query.data)

  const mutation = useMutation({
    mutationFn: async (save: boolean) => {
      if (!uri) throw new Error('no uri')
      await (save ? api.saveUris([uri]) : api.removeUris([uri]))
      return save
    },
    onMutate: async (save) => {
      if (preset === 'lookup') queryClient.setQueryData(key, save)
    },
    onError: (_err, save) => {
      if (preset !== 'lookup') return
      queryClient.setQueryData(key, !save)
      queryClient.invalidateQueries({ queryKey: ['saved-contains'] })
    },
    onSuccess: () => {
      // Keep every other saved-state consumer and saved lists fresh.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'saved-contains' })
    }
  })

  return {
    saved: stored,
    toggle: () => mutation.mutate(!stored),
    pending: mutation.isPending
  }
}
