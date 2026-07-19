const TONES = {
  neutral: 'bg-gray-100 text-gray-600',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
}

export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${TONES[tone] ?? TONES.neutral} ${className}`}>
      {children}
    </span>
  )
}
