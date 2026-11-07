// Sends daily check-in reminders. A scheduled database job wakes this when a device is due.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const PARALLEL_SENDS = 25
// A reminder is only useful for the rest of the evening.
const TTL_SECONDS = 4 * 3600
const SUBSCRIPTION_GONE = new Set([404, 410])

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

type Reminder = { endpoint: string; p256dh: string; auth: string; room_ids: string[] }

// Room names stay out of the message: notifications show on lock screens.
function messageFor({ room_ids: rooms }: Reminder) {
  return JSON.stringify({
    body: rooms.length === 1
      ? 'You haven’t checked in today.'
      : `You haven’t checked in to ${rooms.length} rooms today.`,
    url: rooms.length === 1 ? `/#/room/${rooms[0]}` : '/',
  })
}

Deno.serve(async (req) => {
  if (req.headers.get('x-dispatch-secret') !== Deno.env.get('DISPATCH_SECRET')) {
    return new Response('Forbidden', { status: 403 })
  }

  const { data, error } = await admin.rpc('claim_due_reminders')
  if (error) return new Response(error.message, { status: 500 })
  const reminders: Reminder[] = data

  let sent = 0
  const deadEndpoints: string[] = []
  for (let i = 0; i < reminders.length; i += PARALLEL_SENDS) {
    const slice = reminders.slice(i, i + PARALLEL_SENDS)
    const results = await Promise.allSettled(slice.map((reminder) => webpush.sendNotification(
      { endpoint: reminder.endpoint, keys: { p256dh: reminder.p256dh, auth: reminder.auth } },
      messageFor(reminder),
      { TTL: TTL_SECONDS },
    )))
    results.forEach((result, j) => {
      if (result.status === 'fulfilled') sent++
      else if (SUBSCRIPTION_GONE.has(result.reason?.statusCode)) deadEndpoints.push(slice[j].endpoint)
      else console.error('send failed', result.reason?.statusCode, result.reason?.body ?? result.reason?.message)
    })
  }

  if (deadEndpoints.length) {
    const { error: removeError } = await admin.rpc('remove_push_subscriptions', { endpoints: deadEndpoints })
    if (removeError) console.error('cleanup failed', removeError.message)
  }
  return new Response(JSON.stringify({ sent, removed: deadEndpoints.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
