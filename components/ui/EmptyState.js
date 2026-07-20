export default function EmptyState({ icon, title, description, action, tone = 'default' }) {
  const wash = tone === 'error' ? 'bg-red-50' : 'bg-primary/10'
  const iconColor = tone === 'error' ? 'text-red-500' : 'text-primary'

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${wash}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <p className="text-lg font-semibold text-text-primary mb-1">{title}</p>
      {description && <p className="text-sm text-text-secondary mb-5 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
