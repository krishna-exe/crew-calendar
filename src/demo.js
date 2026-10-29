// In-memory stand-in for the Supabase client, used when VITE_DEMO=1.
// Implements only the calls this app makes. Data resets on reload.
import { keyOf, addDays } from './dates'

const ME = 'demo-you'
const people = [
  [ME, 'Krishna'], ['demo-aisha', 'Aisha'], ['demo-rohan', 'Rohan'], ['demo-meera', 'Meera'],
]
const ago = n => addDays(new Date(), -n)

const db = {
  profiles: people.map(([id, display_name]) => ({ id, display_name })),
  rooms: [
    { id: 'room-gym', name: 'Gym before 9am', invite_code: 'gym4ever01', created_by: ME },
    { id: 'room-read', name: 'Read 20 pages', invite_code: 'readmore22', created_by: 'demo-aisha' },
  ],
  room_members: [
    ...people.map(([id], i) => ({ room_id: 'room-gym', user_id: id, role: i ? 'member' : 'owner', joined_at: ago(45 - i * 3).toISOString() })),
    { room_id: 'room-read', user_id: 'demo-aisha', role: 'owner', joined_at: ago(30).toISOString() },
    { room_id: 'room-read', user_id: ME, role: 'member', joined_at: ago(20).toISOString() },
  ],
  checkins: [],
}
// Deterministic "random" history, with the last few days all done so the crew streak shows.
const notes = ['Leg day', 'Quick 30 min', 'PR on deadlift!', 'Cardio only', '', '', '']
db.room_members.forEach((m, mi) => {
  for (let d = 40; d >= 0; d--) {
    const day = keyOf(ago(d))
    if (day < keyOf(new Date(m.joined_at))) continue
    if (d === 0 && m.user_id !== 'demo-rohan') continue
    if (d > 3 && (d * 7 + mi * 5) % 10 < 3) continue
    db.checkins.push({ room_id: m.room_id, user_id: m.user_id, day, note: notes[(d + mi) % notes.length] })
  }
})

const embeds = {
  profiles: row => db.profiles.find(p => p.id === row.user_id),
  rooms: row => db.rooms.find(r => r.id === row.room_id),
}
const key = { checkins: ['room_id', 'user_id', 'day'], room_members: ['room_id', 'user_id'] }

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select' }
  select(cols = '') { this.cols = cols; return this }
  eq(f, v) { this.filters.push([f, v]); return this }
  match(o) { Object.entries(o).forEach(e => this.filters.push(e)); return this }
  order(f, o = {}) { this.ord = [f, o.ascending !== false]; return this }
  range(a, b) { this.rng = [a, b]; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'single'; return this }
  insert(row) { this.op = 'insert'; this.payload = row; return this }
  update(p) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  then(ok, fail) { return new Promise(r => setTimeout(r, 120)).then(() => this.run()).then(ok, fail) }

  run() {
    const rows = db[this.table]
    const hit = r => this.filters.every(([f, v]) => r[f] === v)
    if (this.op === 'insert') {
      const row = { note: '', ...this.payload }
      if (rows.some(r => key[this.table]?.every(k => r[k] === row[k]))) return { error: { message: 'Already exists' } }
      rows.push(row); return { data: null, error: null }
    }
    if (this.op === 'update') { rows.filter(hit).forEach(r => Object.assign(r, this.payload)); return { error: null } }
    if (this.op === 'delete') {
      const gone = rows.filter(hit)
      db[this.table] = rows.filter(r => !hit(r))
      if (this.table === 'rooms') gone.forEach(g => {
        db.room_members = db.room_members.filter(m => m.room_id !== g.id)
        db.checkins = db.checkins.filter(c => c.room_id !== g.id)
      })
      if (this.table === 'room_members') gone.forEach(g => {
        db.checkins = db.checkins.filter(c => !(c.room_id === g.room_id && c.user_id === g.user_id))
      })
      return { error: null }
    }
    let out = rows.filter(hit).map(r => {
      const row = { ...r }
      for (const [name, find] of Object.entries(embeds)) if (this.cols?.includes(`${name}(`)) row[name] = find(r) ?? null
      return row
    })
    if (this.ord) { const [f, asc] = this.ord; out.sort((a, b) => (a[f] < b[f] ? -1 : a[f] > b[f]) * (asc ? 1 : -1)) }
    if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1)
    if (this.mode) return { data: out[0] ?? null, error: this.mode === 'single' && !out[0] ? { message: 'Not found' } : null }
    return { data: out, error: null }
  }
}

const rpcs = {
  create_room({ room_name }) {
    const id = 'room-' + Math.random().toString(36).slice(2, 8)
    db.rooms.push({ id, name: room_name, invite_code: Math.random().toString(36).slice(2, 12), created_by: ME })
    db.room_members.push({ room_id: id, user_id: ME, role: 'owner', joined_at: new Date().toISOString() })
    return id
  },
  room_preview({ code }) {
    const r = db.rooms.find(r => r.invite_code === code)
    if (!r) return []
    const ms = db.room_members.filter(m => m.room_id === r.id)
    return [{ id: r.id, name: r.name, member_count: ms.length, already_member: ms.some(m => m.user_id === ME) }]
  },
  join_room({ code }) {
    const r = db.rooms.find(r => r.invite_code === code)
    if (!r) throw new Error('This invite link is invalid or has been reset')
    db.room_members.push({ room_id: r.id, user_id: ME, role: 'member', joined_at: new Date().toISOString() })
    return r.id
  },
  reset_invite({ r }) {
    const room = db.rooms.find(x => x.id === r)
    room.invite_code = Math.random().toString(36).slice(2, 12)
    return room.invite_code
  },
}

let session = { user: { id: ME, email: 'you@example.com' } }
const listeners = new Set()
const setSession = s => { session = s; listeners.forEach(fn => fn('SIGNED_IN', s)) }

const channel = { on() { return channel }, subscribe() { return channel }, send() {} }

export const demoClient = {
  from: table => new Query(table),
  async rpc(name, args) {
    try { return { data: rpcs[name](args), error: null } } catch (e) { return { data: null, error: { message: e.message } } }
  },
  channel: () => channel,
  removeChannel() {},
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange(fn) { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } } },
    async signInWithOtp() { setTimeout(() => setSession({ user: { id: ME, email: 'you@example.com' } }), 2500); return { error: null } },
    async signOut() { setSession(null) },
  },
}
