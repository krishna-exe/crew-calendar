import { MONTHS, keyOf, todayKey } from '../dates'
import Avatar from '../Avatar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_FACES = 4

export default function Calendar({ view, setView, sel, setSel, doneOn, isFull, isRest, mine, name, hasRestDays }) {
  const y = view.getFullYear(), m = view.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const len = new Date(y, m + 1, 0).getDate()
  const tk = todayKey()
  const now = new Date()
  const atCurrentMonth = y === now.getFullYear() && m === now.getMonth()
  const shift = n => setView(new Date(y, m + n, 1))
  const goToday = () => { setView(new Date(now.getFullYear(), now.getMonth(), 1)); setSel(tk) }

  // On phones the day sheet sits below the calendar, so bring it into view.
  const pick = k => {
    setSel(k)
    if (window.matchMedia('(max-width: 860px)').matches) {
      const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches
      requestAnimationFrame(() => document.getElementById('day-panel')?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }))
    }
  }

  return (
    <section className="cal" aria-label="Calendar">
      <div className="cal-head">
        <h2>{MONTHS[m]} {y}</h2>
        <div className="nav">
          <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button onClick={goToday}>Today</button>
          <button onClick={() => shift(1)} disabled={atCurrentMonth} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="dow">{WEEKDAYS.map(d => <div key={d}>{d}</div>)}</div>
      <div className="grid">
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className="day blank" />)}
        {Array.from({ length: len }, (_, i) => {
          const k = keyOf(new Date(y, m, i + 1))
          const who = doneOn(k)
          const full = isFull(k)
          const rest = isRest(k)
          const cls = ['day',
            k > tk && 'future', k === tk && 'today', k === sel && 'sel',
            full && 'full', rest && !full && 'rest', mine(k) && 'mine'].filter(Boolean).join(' ')
          return (
            <button key={k} className={cls} disabled={k > tk} onClick={() => pick(k)}
              aria-current={k === tk ? 'date' : undefined} aria-pressed={k === sel}
              aria-label={`${MONTHS[m]} ${i + 1}${rest ? ', rest day' : ''}: ${who.length} checked in`}>
              <span className="n">{i + 1}</span>
              <span className="faces">
                {who.slice(0, MAX_FACES).map(id => <Avatar key={id} id={id} name={name(id)} size={18} />)}
                {who.length > MAX_FACES && <span className="more">+{who.length - MAX_FACES}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="sw sw-full" />Whole crew checked in</span>
        <span><i className="sw sw-mine" />You checked in</span>
        {hasRestDays && <span><i className="sw sw-rest" />Rest day</span>}
      </div>
    </section>
  )
}
