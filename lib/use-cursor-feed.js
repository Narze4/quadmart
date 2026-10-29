'use client'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createCursorFeed } from './cursor-feed.mjs'

export function useCursorFeed(configuration) {
  const feed = useMemo(() => createCursorFeed(configuration), [configuration])
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
  useEffect(() => { feed.start(); return () => feed.dispose() }, [feed])
  return { ...state, loadMore: feed.load, updateItems: feed.updateItems }
}
