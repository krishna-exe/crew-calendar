// Daily reminder on this device, by web push. The server holds the time and timezone.
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const remindersConfigured = Boolean(VAPID_PUBLIC_KEY)

export const remindersSupported = () =>
  remindersConfigured && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToBytes(value) {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

// The reminder hour on this device, or null when reminders are off.
export async function getReminderHour() {
  const subscription = await currentSubscription()
  if (!subscription) return null
  return unwrap(await supabase.rpc('get_reminder_hour', { sub_endpoint: subscription.endpoint }))
}

export async function saveReminder(hour) {
  if (await Notification.requestPermission() !== 'granted') throw new Error('permission-denied')
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY),
  })
  const { endpoint, keys } = subscription.toJSON()
  unwrap(await supabase.rpc('set_reminder', {
    sub_endpoint: endpoint,
    sub_p256dh: keys.p256dh,
    sub_auth: keys.auth,
    hour,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }))
}

export async function clearReminder() {
  const subscription = await currentSubscription()
  if (!subscription) return
  unwrap(await supabase.rpc('clear_reminder', { sub_endpoint: subscription.endpoint }))
  await subscription.unsubscribe()
}
