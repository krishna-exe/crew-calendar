import { useEffect, useRef, useState } from 'react'
import { addDays, keyOf, parseKey, streaks, todayKey } from '../dates'
import Avatar from '../Avatar'
import Reactions from './Reactions'
import { reactionsOn } from './reactions'

const CONFIRM_MS = 2000

async function sendNudge({ names, room, onNotice, onError }) {
  const url = `${window.location.origin}${window.location.pathname}#/room/${room.id}`
  const text = `${names}: you haven’t checked in to “${room.name}” today.`
  if (navigator.share) {
    try { await navigator.share({ text, url }); return }
    catch (e) { if (e.name === 'AbortError') return }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    onNotice('Nudge copied. Paste it in your group chat.')
  } catch { onError('Couldn’t copy the nudge.') }
}

function dayLabel(sel, d) {
  if (sel === todayKey()) return 'Today'
  if (sel === keyOf(addDays(new Date(), -1))) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long' })
}

export default function DayPanel({ sel, ids, joined, me, days, did, name, room, isRest, reactions, onToggle, onSaveNote, onReact, onNotice, onError }) {
  const buttonLabel = room.checkin_label
  const d = parseKey(sel)
  const mine = did(me, sel)
  const stored = days[me]?.[sel] ?? ''
  const [note, setNote] = useState(stored)
  const [saved, setSaved] = useState(false)
  const [pop, setPop] = useState(false)
  useEffect(() => setNote(stored), [stored, sel])
  useEffect(() => setSaved(false), [sel])

  // Phones: keep the main action reachable while its button is below the screen.
  const mainButton = useRef(null)
  const [buttonBelow, setButtonBelow] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => setButtonBelow(!e.isIntersecting && e.boundingClientRect.top > 0),
      { threshold: 1 },
    )
    io.observe(mainButton.current)
    return () => io.disconnect()
  }, [])

  async function submitNote(e) {
    e.preventDefault()
    if (await onSaveNote(note.trim())) { setSaved(true); setTimeout(() => setSaved(false), CONFIRM_MS) }
  }

  const meFirst = (a, b) => (b === me) - (a === me)
  const done = ids.filter(id => did(id, sel)).sort(meFirst)
  const waiting = ids.filter(id => !did(id, sel) && joined[id] <= sel).sort(meFirst)
  const total = done.length + waiting.length
  const everyone = total >= 2 && waiting.length === 0
  const isToday = sel === todayKey()
  const rest = isRest(sel)
  const expected = isToday && !rest
  const myStreak = expected && !mine ? streaks(k => did(me, k), isRest) : 0
  const others = waiting.filter(id => id !== me)

  return (
    <section id="day-panel" className="panel" aria-live="polite">
      <div className="eyebrow">{dayLabel(sel, d)}{rest && ' · Rest day'}</div>
      <h3>{d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
      <button ref={mainButton} className={`big ${mine ? 'done' : ''} ${pop ? 'pop' : ''}`} aria-pressed={mine}
        onClick={() => { setPop(!mine); onToggle() }} onAnimationEnd={() => setPop(false)}>
        {mine ? `✓ ${buttonLabel || 'Checked in'} · tap to undo` : (buttonLabel || 'Check in')}
      </button>
      {expected && !mine && buttonBelow && (
        <div className="checkin-bar">
          <button className="big" onClick={() => { setPop(true); onToggle() }}>{buttonLabel || 'Check in'}</button>
        </div>
      )}
      {myStreak > 0 && <p className="keep small">Check in today to keep your {myStreak}-day streak going.</p>}
      {rest && !mine && <p className="keep small">Rest day: your streak is safe, but you can still check in.</p>}
      {mine && (
        <form className="note-row" onSubmit={submitNote}>
          <input id="note" maxLength={140} placeholder="Add a note (optional)" value={note}
            onChange={e => setNote(e.target.value)} />
          <button disabled={!saved && note.trim() === stored}>{saved ? 'Saved' : 'Save'}</button>
        </form>
      )}
      {total > 0 && (
        <div className="progress">
          <div className="progress-text small">
            {everyone ? 'Whole crew checked in 🎉' : `${done.length} of ${total} checked in`}
          </div>
          <div className="bar" aria-hidden="true">
            <i className={everyone ? 'all' : ''} style={{ width: `${(done.length / total) * 100}%` }} />
          </div>
          {expected && others.length > 0 && (
            <button className="link small nudge"
              onClick={() => sendNudge({ names: others.map(name).join(', '), room, onNotice, onError })}>
              Nudge the crew
            </button>
          )}
        </div>
      )}
      <ul className="who">
        {done.map(id => (
          <li key={id}>
            <Avatar id={id} name={name(id)} />
            <div>
              <div className="nm">{name(id)}</div>
              <div className="nt">{days[id][sel] || 'Checked in'}</div>
              <Reactions received={reactionsOn(reactions, id, sel)} me={me} canReact={id !== me} name={name}
                onReact={emoji => onReact(id, emoji)} />
            </div>
          </li>
        ))}
        {waiting.map(id => (
          <li key={id} className="missing">
            <Avatar id={id} name={name(id)} />
            <div><div className="nm">{name(id)}</div><div className="nt">{rest ? 'Resting' : 'Not yet'}</div></div>
          </li>
        ))}
      </ul>
    </section>
  )
}
