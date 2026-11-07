import { useEffect, useState } from 'react'
import { clearReminder, getReminderHour, remindersConfigured, remindersSupported, saveReminder } from './reminders'

const DEFAULT_HOUR = 20
const hourLabel = hour => new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Reminders() {
  const supported = remindersSupported()
  const [hour, setHour] = useState(undefined) // undefined: loading, null: off
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supported) return
    getReminderHour().then(setHour).catch(() => setHour(null))
  }, [supported])

  async function apply(action, nextHour) {
    setBusy(true); setError('')
    try {
      await action()
      setHour(nextHour)
    } catch (e) {
      setError(e.message === 'permission-denied'
        ? 'Notifications are blocked. Allow them for this site in your browser settings, then try again.'
        : 'Couldn’t update your reminder. Try again.')
    }
    setBusy(false)
  }

  if (!remindersConfigured) return null

  return (
    <section className="panel stack">
      <h3>Daily reminder</h3>
      {!supported ? (
        <p className="muted small">
          This browser can’t send reminders. They work in Chrome, Edge and Firefox on Android and
          computers, but not in iPhone browsers.
        </p>
      ) : hour === undefined ? (
        <p className="muted small">Loading…</p>
      ) : hour === null ? (
        <>
          <p className="muted small">A notification on this device if you haven’t checked in by evening. It never shows room names.</p>
          <button className="big" disabled={busy} onClick={() => apply(() => saveReminder(DEFAULT_HOUR), DEFAULT_HOUR)}>
            {busy ? 'Turning on…' : `Remind me at ${hourLabel(DEFAULT_HOUR)}`}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="reminder-hour">Remind me at</label>
          <select id="reminder-hour" value={hour} disabled={busy}
            onChange={e => { const next = Number(e.target.value); apply(() => saveReminder(next), next) }}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <p className="muted small">Only if a room is still waiting, and never on its rest day.</p>
          <button className="link small danger reminder-off" disabled={busy} onClick={() => apply(clearReminder, null)}>
            Turn off reminders
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
