import Button from '@/components/ui/Button'

export default function FeedStatus({ feed, noun, moreLabel, onRestart }) {
  return <div className="mt-6 space-y-3 text-center" aria-live="polite">
    {feed.loading && <p role="status" className="text-sm text-text-secondary">Loading {noun}…</p>}
    {!feed.loading && !feed.denied && <p className="text-sm text-text-secondary">{feed.items.length} {feed.items.length === 1 ? noun.replace(/s$/, '') : noun} loaded{feed.hasMore ? ' so far' : ''}</p>}
    {feed.historyReset && <p className="text-sm text-text-secondary">New activity refreshed this list. Load older {noun} again to continue.</p>}
    {feed.error && <div role="alert"><p className="text-sm text-red-700">{feed.error}</p><Button className="mt-2" onClick={feed.denied || feed.watchError ? onRestart : feed.loadMore}>Try again</Button></div>}
    {!feed.loading && !feed.error && feed.hasMore && <Button variant="secondary" onClick={feed.loadMore} loading={feed.loadingMore}>{moreLabel}</Button>}
  </div>
}
