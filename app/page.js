'use client'

import { useState } from 'react'
import Link from 'next/link'
import PublicHeader from '@/components/PublicHeader'
import Footer from '@/components/Footer'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { UNIVERSITIES as SUPPORTED_UNIVERSITIES } from '@/lib/universities'

const UNIVERSITY_DISPLAY = {
  'Emory University': { abbr: 'EU', color: '#012169' },
  'University of Georgia': { abbr: 'UGA', color: '#BA0C2F' },
  'Georgia Institute of Technology': { abbr: 'GT', color: '#B3A369' },
  'SCAD University': { abbr: 'SCAD', color: '#000000' },
  'Georgia State University': { abbr: 'GSU', color: '#0039A6' },
  'Kennesaw State University': { abbr: 'KSU', color: '#FDBB30' },
  'University of Tennessee': { abbr: 'UT', color: '#FF8200' },
}

const UNIVERSITIES = SUPPORTED_UNIVERSITIES.map(u => ({ name: u.name, ...UNIVERSITY_DISPLAY[u.name] }));

const COLLAGE_ITEMS = [
  { icon: '📚', label: 'Textbooks', pos: 'top-10 left-[4%] -rotate-6' },
  { icon: '🛋️', label: 'Furniture', pos: 'bottom-12 left-[9%] rotate-3' },
  { icon: '💻', label: 'Laptops', pos: 'top-14 right-[5%] rotate-6' },
  { icon: '🚲', label: 'Bikes', pos: 'bottom-16 right-[10%] -rotate-3' },
  { icon: '🛏️', label: 'Dorm gear', pos: 'top-1/2 right-[1%] -translate-y-1/2 rotate-2' },
]

const TRUST_ROW = [
  { icon: '🎓', label: 'Verified university email' },
  { icon: '👥', label: 'Student-only communities' },
  { icon: '📍', label: 'Local campus transactions' },
  { icon: '🏫', label: 'No listings outside your school' },
]

const CATEGORIES = [
  { icon: '🛋️', label: 'Furniture' },
  { icon: '💻', label: 'Electronics' },
  { icon: '📚', label: 'Textbooks' },
  { icon: '👕', label: 'Clothing' },
  { icon: '🏠', label: 'Subleases' },
  { icon: '✏️', label: 'Tutoring' },
  { icon: '🛠️', label: 'Services' },
  { icon: '📦', label: 'Other' },
]

const SAMPLE_LISTINGS = [
  { icon: '📚', title: 'Calculus Textbook (8th ed.)', price: 35, condition: 'Good', tone: 'yellow' },
  { icon: '🛋️', title: 'Grey Loveseat Sofa', price: 80, condition: 'Like New', tone: 'blue' },
  { icon: '💻', title: 'MacBook Air 2021', price: 550, condition: 'Good', tone: 'yellow' },
  { icon: '🚲', title: 'Mountain Bike, 21-speed', price: 120, condition: 'Fair', tone: 'orange' },
]

const BUYER_STEPS = [
  { title: 'Verify email', desc: 'Sign up with your .edu address to confirm you’re a student at your school.' },
  { title: 'Browse listings', desc: 'See what’s for sale or offer, posted only by students at your university.' },
  { title: 'Connect and transact', desc: 'Message the seller, agree on a time and place, and meet up on campus.' },
]

const SELLER_STEPS = [
  { title: 'Create a listing', desc: 'Add photos, a price, and a description in a few quick steps.' },
  { title: 'Reach your campus', desc: 'Your listing is visible to verified students at your school only.' },
  { title: 'Manage messages', desc: 'Buyers message you directly in-app — reply, negotiate, and set up a meetup.' },
]

const SAFETY_POINTS = [
  {
    icon: '🎓',
    title: 'Email verification',
    desc: 'Every account is verified with a university email before they can post or message.',
  },
  {
    icon: '📍',
    title: 'Public meeting tips',
    desc: 'We recommend meeting in busy, public spots on campus — a dining hall, library, or dorm lobby.',
  },
  {
    icon: '💬',
    title: 'Secure messaging',
    desc: 'Buyers and sellers talk through QuadMart’s built-in messaging — no need to share personal contact info upfront.',
  },
]

export default function LandingPage() {
  const [heroQuery, setHeroQuery] = useState('')
  const [uniQuery, setUniQuery] = useState('')

  const heroMatches = heroQuery.trim()
    ? UNIVERSITIES.filter(u => u.name.toLowerCase().includes(heroQuery.trim().toLowerCase())).slice(0, 5)
    : []

  const filteredUniversities = uniQuery.trim()
    ? UNIVERSITIES.filter(u => u.name.toLowerCase().includes(uniQuery.trim().toLowerCase()))
    : UNIVERSITIES

  return (
    <div className="min-h-full flex flex-col bg-surface">
      <PublicHeader />

      {/* Hero */}
      <section
        className="relative overflow-hidden text-white px-6 py-24"
        style={{ background: "linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 55%, #123d27 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Collage */}
        {COLLAGE_ITEMS.map(item => (
          <div
            key={item.label}
            aria-hidden="true"
            className={`hidden lg:flex absolute ${item.pos} items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3.5 py-2 shadow-sm`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium text-white/90 whitespace-nowrap">{item.label}</span>
          </div>
        ))}

        <div className="relative max-w-2xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-5 tracking-tight">
            Your campus marketplace.
          </h1>
          <p className="text-lg text-green-100 mb-8">
            Buy, sell and find student services from verified people at your university.
          </p>

          {/* University search */}
          <div className="relative max-w-md mx-auto mb-6">
            <input
              type="text"
              value={heroQuery}
              onChange={e => setHeroQuery(e.target.value)}
              placeholder="Search your university…"
              className="w-full px-5 py-3 rounded-xl text-text-primary bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white text-sm shadow-sm"
            />
            {heroMatches.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-surface rounded-xl border border-border shadow-md overflow-hidden text-left z-20">
                {heroMatches.map(u => (
                  <Link
                    key={u.name}
                    href="/signup"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-bg transition-colors"
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.abbr}
                    </span>
                    <span className="text-sm text-text-primary">{u.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-primary-dark font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              Explore your campus
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-xl hover:bg-white hover:text-primary-dark transition-all duration-200 active:scale-95 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              Sell something
            </Link>
          </div>
        </div>
      </section>

      {/* Trust row */}
      <section className="px-6 py-8 bg-bg border-b border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TRUST_ROW.map(item => (
            <div key={item.label} className="flex items-center gap-2.5 justify-center sm:justify-start">
              <span className="text-xl shrink-0" aria-hidden="true">{item.icon}</span>
              <span className="text-sm font-medium text-text-primary">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 py-16 bg-surface">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-10">
            Shop by category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.label}
                href="/signup"
                className="flex flex-col items-center gap-2 bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {cat.icon}
                </div>
                <span className="text-sm font-medium text-text-primary">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured preview */}
      <section className="px-6 py-16 bg-bg">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-2">
            What people are listing
          </h2>
          <p className="text-sm text-text-secondary text-center mb-10">
            A few sample listings to show what QuadMart looks like — sign up to see what&apos;s actually posted at your school.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {SAMPLE_LISTINGS.map(item => (
              <Card key={item.title} interactive className="overflow-hidden">
                <div className="relative h-32 bg-primary/5 flex items-center justify-center text-4xl">
                  {item.icon}
                  <Badge tone="neutral" className="absolute top-2 left-2 bg-white/90">Sample listing</Badge>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-text-primary text-sm leading-snug line-clamp-2">{item.title}</h3>
                    <Badge tone={item.tone}>{item.condition}</Badge>
                  </div>
                  <p className="text-sm font-bold text-primary-dark">${item.price.toFixed(2)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* University Cards */}
      <section id="universities" className="scroll-mt-20 px-6 py-16 bg-surface">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">
            Available at your school
          </h2>
          <div className="max-w-sm mx-auto mb-10">
            <input
              type="text"
              value={uniQuery}
              onChange={e => setUniQuery(e.target.value)}
              placeholder="Search universities…"
              className="input-field text-center"
            />
          </div>

          {filteredUniversities.length === 0 ? (
            <p className="text-center text-text-secondary text-sm mb-4">No matches — try a different search.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {filteredUniversities.map((uni) => (
                <Link
                  href="/signup"
                  key={uni.name}
                  className="relative overflow-hidden bg-surface rounded-2xl border border-border p-7 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: uni.color }}
                    aria-hidden="true"
                  />
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: uni.color }}
                  >
                    {uni.abbr}
                  </div>
                  <span className="text-base font-medium text-text-primary text-center">
                    {uni.name}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <p className="text-center text-sm text-text-secondary">
            Don&apos;t see your school?{' '}
            <a href="mailto:hello@quadmart.app" className="text-primary-dark font-medium hover:underline">
              Email us
            </a>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-16 bg-bg">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-2">
            How it works
          </h2>
          <p className="text-sm text-text-secondary text-center mb-10">
            Whether you&apos;re buying or selling, it only takes a few steps.
          </p>
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-4 text-center md:text-left">For buyers</p>
              <div className="flex flex-col gap-6">
                {BUYER_STEPS.map((step, i) => (
                  <div key={step.title} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary-dark shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary mb-1">{step.title}</h3>
                      <p className="text-sm text-text-secondary">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-4 text-center md:text-left">For sellers</p>
              <div className="flex flex-col gap-6">
                {SELLER_STEPS.map((step, i) => (
                  <div key={step.title} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary-dark shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary mb-1">{step.title}</h3>
                      <p className="text-sm text-text-secondary">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="scroll-mt-20 px-6 py-16 bg-surface">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-2">
            Built to be safe
          </h2>
          <p className="text-sm text-text-secondary text-center mb-10">
            QuadMart is designed around trust between students at the same school.
          </p>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {SAFETY_POINTS.map((point) => (
              <div key={point.title} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl mb-4">
                  {point.icon}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{point.title}</h3>
                <p className="text-sm text-text-secondary">{point.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
