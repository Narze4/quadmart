import Link from 'next/link'

const VARIANTS = {
  primary: 'bg-primary-dark text-white hover:bg-primary-dark-hover',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-bg',
  outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary/10',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  href,
  className = '',
  children,
  ...rest
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || loading} {...rest}>
        {loading && <Spinner />}
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}
