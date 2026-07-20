const CATEGORY_STYLE = {
  Product: { icon: '📦', bg: 'bg-purple-50' },
  Service: { icon: '🛠️', bg: 'bg-cyan-50' },
  Sublease: { icon: '🏠', bg: 'bg-amber-50' },
}

const SIZE_TEXT = {
  sm: 'text-lg',
  md: 'text-4xl',
}

export default function CategoryPlaceholder({ category, size = 'md', className = '' }) {
  const style = CATEGORY_STYLE[category] ?? { icon: '🛍️', bg: 'bg-gray-50' }
  return (
    <div className={`w-full h-full flex items-center justify-center ${style.bg} ${className}`}>
      <span className={SIZE_TEXT[size] ?? SIZE_TEXT.md} aria-hidden="true">{style.icon}</span>
    </div>
  )
}
