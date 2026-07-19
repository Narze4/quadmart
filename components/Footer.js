import Link from 'next/link'

const CubeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Universities', href: '/#universities' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Safety', href: '/#safety' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help', disabled: true },
      { label: 'Terms', disabled: true },
      { label: 'Privacy', disabled: true },
      { label: 'Contact', href: 'mailto:hello@quadmart.app' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="mt-auto bg-primary-dark text-green-200">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon />
            <span className="text-white font-bold text-lg">QuadMart</span>
          </div>
          <p className="text-sm text-green-300 max-w-xs">Your campus marketplace, student to student.</p>
        </div>

        {COLUMNS.map(col => (
          <div key={col.title}>
            <p className="text-xs font-semibold text-white uppercase tracking-wide mb-3">{col.title}</p>
            <ul className="flex flex-col gap-2">
              {col.links.map(link => (
                <li key={link.label}>
                  {link.disabled ? (
                    <span className="text-sm text-green-300/60 cursor-default">{link.label}</span>
                  ) : (
                    <Link href={link.href} className="text-sm text-green-200 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-green-300">
        © {new Date().getFullYear()} QuadMart · Student Marketplace
      </div>
    </footer>
  )
}
