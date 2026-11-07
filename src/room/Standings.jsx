import { MONTHS, bestStreak, keyOf, streaks } from '../dates'
import Avatar from '../Avatar'

export default function Standings({ ids, days, view, name, isFull, isRest }) {
  const prefix = keyOf(view).slice(0, 8)
  const rows = ids.map(id => {
    const mine = days[id] || {}
    const keys = Object.keys(mine)
    return {
      id,
      cur: streaks(k => mine[k] !== undefined, isRest),
      best: bestStreak(keys, isRest),
      month: keys.filter(k => k.startsWith(prefix)).length,
    }
  }).sort((a, b) => b.cur - a.cur || b.month - a.month)
  const crew = ids.length >= 2 ? streaks(isFull, isRest) : 0

  return (
    <section className="panel">
      <div className="eyebrow">Standings</div>
      <h3>The crew</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Person</th><th>Streak</th><th>Best</th><th>{MONTHS[view.getMonth()].slice(0, 3)}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><span className="p"><Avatar id={r.id} name={name(r.id)} /><span>{name(r.id)}</span></span></td>
                <td>{r.cur ? `${r.cur}🔥` : 0}</td><td>{r.best}</td><td>{r.month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {crew > 0 && <div className="squad">Whole-crew streak: <b>{crew}</b> day{crew === 1 ? '' : 's'} in a row</div>}
    </section>
  )
}
