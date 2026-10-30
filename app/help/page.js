import Link from 'next/link'
import PublicHeader from '@/components/PublicHeader'
import Footer from '@/components/Footer'

export const metadata = { title: 'Help | QuadMart', description: 'Help with university email verification, listings, photos, messages and account access.' }

const linkStyle = 'font-medium text-primary-dark underline underline-offset-2'

export default function HelpPage() {
  return <div className="min-h-screen flex flex-col bg-bg">
    <PublicHeader />
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold">Help with QuadMart</h1>
      <p className="mt-3 text-text-secondary">Find the next step for your account, listing or conversation.</p>
      <nav aria-label="Help topics" className="my-8 flex flex-wrap gap-x-5 gap-y-3">
        <a className={linkStyle} href="#verification">Email verification</a>
        <a className={linkStyle} href="#photos">Listings and photos</a>
        <a className={linkStyle} href="#trading">Trading and reviews</a>
        <a className={linkStyle} href="#safety">Reports and blocks</a>
        <a className={linkStyle} href="#account">Account help</a>
      </nav>
      <div className="space-y-6">
        <section id="verification" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Verify your university email</h2>
          <p>Use an email from a <Link className={linkStyle} href="/#universities">supported university</Link>. Open the verification link in that inbox, then return to QuadMart and choose “I&apos;ve verified, continue.”</p>
          <p>If the email is missing, check spam and wait for the resend button to become available. If checking your verification fails, keep the page open and choose “I&apos;ve verified, continue” again after reconnecting.</p>
          <p>Email verification confirms access to a university mailbox. It does not establish current enrollment, verify someone&apos;s identity, or guarantee a safe trade.</p>
        </section>
        <section id="photos" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Create a listing and add photos</h2>
          <p>Add a clear title, description, price and condition. You can attach up to five JPG, PNG or WebP images, each no larger than 3 MB. Convert HEIC images to a supported format before uploading.</p>
          <p>Wait for the photo preview before posting. If an upload fails, keep your listing details on the page, check the error, and retry. A limit message may ask you to wait first.</p>
          <p>Use <Link className={linkStyle} href="/my-listings">My Listings</Link> to manage your items. A completed post should appear there; check before creating a second copy after an interrupted request.</p>
        </section>
        <section id="trading" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Messages, sales and reviews</h2>
          <p>Message the seller to agree on the item, price and meetup. Meet in a busy public place and inspect the item before completing the exchange.</p>
          <p>QuadMart records completed trades. It does not process payments or provide checkout, escrow or refunds.</p>
          <p>The seller marks the listing sold and selects the buyer. A linked buyer can find the completed trade in <Link className={linkStyle} href="/my-purchases">Purchases</Link> and leave one review for that trade. An off-platform sale does not create a purchase for a QuadMart buyer.</p>
          <p>If sending a message fails, keep the draft, reconnect, and retry once. Check the conversation for the message before submitting another copy.</p>
        </section>
        <section id="safety" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Report a concern or block someone</h2>
          <p>Use Report on a listing, profile or conversation and explain what happened. A conversation report includes recent messages for moderator review.</p>
          <p>Blocking stops new messages and trades between the two accounts. Existing conversation history and completed-trade reviews remain, and blocking does not hide every campus listing.</p>
          <p>Visit the <Link className={linkStyle} href="/safety">Safety center</Link> to view your reports and manage your blocks. A report is reviewed separately from blocking.</p>
        </section>
        <section id="account" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Account access and closure</h2>
          <p>For a forgotten password, choose Forgot password? on the <Link className={linkStyle} href="/login">login page</Link>. Only use the reset link from your own inbox. Never share a password or verification code.</p>
          <p>A temporary connection problem should offer a retry. Keep unsaved details on the page while reconnecting. If your session ends, sign in again. A suspension message requires support review.</p>
          <p>Account closure starts in <Link className={linkStyle} href="/settings">Settings</Link> and requires your current password. If interrupted, sign in again to continue the cleanup.</p>
          <p>Closure removes your listings and private profile through a cleanup process. Shared messages, completed trades, reviews and moderation records remain; photos are cleaned separately, and existing backups may still contain earlier records. Review the closure screen before continuing.</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Need more help?</h2>
          <p>Use the <a className={linkStyle} href="mailto:hello@quadmart.app">contact address</a> and include the page, what you tried, and any request reference shown in the error. Leave passwords, verification codes and private chat contents out of your message.</p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
}
