export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

const pad = n => String(n).padStart(2, '0')

// Days are local-calendar 'YYYY-MM-DD' strings, matching Postgres `date`.
export const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const todayKey = () => keyOf(new Date())

const never = () => false

// Returns a test for whether a day is one of the room's rest weekdays (0 = Sunday).
// If every weekday were a rest day nothing could ever break a streak, so that counts as none.
export function restChecker(restDays = []) {
  const days = new Set(restDays)
  return days.size >= 7 ? never : k => days.has(parseKey(k).getDay())
}

// Current streak counts back from today, or from yesterday if today isn't done yet.
// A rest day that wasn't done is skipped: it neither adds to the streak nor breaks it.
export function streaks(isDone, isRest = never) {
  let d = new Date()
  if (!isDone(keyOf(d))) d = addDays(d, -1)
  let cur = 0
  for (;;) {
    const k = keyOf(d)
    if (isDone(k)) cur++
    else if (!isRest(k)) return cur
    d = addDays(d, -1)
  }
}

function onlyRestBetween(from, to, isRest) {
  for (let d = addDays(parseKey(from), 1); keyOf(d) < to; d = addDays(d, 1)) {
    if (!isRest(keyOf(d))) return false
  }
  return true
}

export function bestStreak(keys, isRest = never) {
  let best = 0, run = 0, prev = null
  for (const k of [...keys].sort()) {
    run = prev && onlyRestBetween(prev, k, isRest) ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return best
}
