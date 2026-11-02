import Link from 'next/link'
export default function AccountClosedPage() {
  return <main className="mx-auto my-20 max-w-lg px-6">
    <h1 className="text-3xl font-semibold mb-4">Your login has been deleted</h1>
    <p className="mb-4">Your marketplace listings, saved items and private profile have been removed. Your public name is now shown as Deleted student.</p>
    <p className="text-sm text-text-secondary mb-6">Shared messages, trade history, reviews and moderation records are retained. Unused photos are queued for separate cleanup; photos kept as moderation evidence are preserved.</p>
    <Link href="/" className="underline">Return to QuadMart</Link>
  </main>
}
