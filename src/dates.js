export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

const pad = n => String(n).padStart(2, '0')

// Days are local-calendar 'YYYY-MM-DD' strings, matching Postgres `date`.
export const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const todayKey = () => keyOf(new Date())

// Current streak counts back from today, or from yesterday if today isn't done yet.
export function streaks(isDone) {
  let d = new Date()
  if (!isDone(keyOf(d))) d = addDays(d, -1)
  let cur = 0
  while (isDone(keyOf(d))) { cur++; d = addDays(d, -1) }
  return cur
}

export function bestStreak(keys) {
  let best = 0, run = 0, prev = null
  for (const k of [...keys].sort()) {
    run = prev && keyOf(addDays(parseKey(prev), 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return best
}
