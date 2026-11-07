import { EMOJIS } from './reactions'

// Friends can tap any emoji. On your own check-in you see only what you received.
export default function Reactions({ received, me, canReact, name, onReact }) {
  const shown = canReact ? EMOJIS : EMOJIS.filter(e => received[e]?.length)
  if (shown.length === 0) return null

  return (
    <div className="reactions">
      {shown.map(emoji => {
        const from = received[emoji] ?? []
        const label = from.length ? `${emoji} from ${from.map(name).join(', ')}` : `React with ${emoji}`
        return canReact ? (
          <button key={emoji} className={`reaction ${from.includes(me) ? 'on' : ''}`} title={label} aria-label={label}
            aria-pressed={from.includes(me)} onClick={() => onReact(emoji)}>
            {emoji}{from.length > 0 && <span className="count">{from.length}</span>}
          </button>
        ) : (
          <span key={emoji} className="reaction" title={label} aria-label={label}>
            {emoji}<span className="count">{from.length}</span>
          </span>
        )
      })}
    </div>
  )
}
