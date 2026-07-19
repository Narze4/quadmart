export default function Card({ interactive = false, className = '', children, ...rest }) {
  const base = 'bg-surface border border-border rounded-2xl shadow-sm'
  const hover = interactive ? 'hover:shadow-md transition-all duration-200' : ''
  return (
    <div className={`${base} ${hover} ${className}`} {...rest}>
      {children}
    </div>
  )
}
