const HUES = [232, 12, 160, 280, 40, 330, 195, 100]

function hueFor(id) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return HUES[Math.abs(h) % HUES.length]
}

export default function Avatar({ id, name, size = 28 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="avatar" title={name}
      style={{ width: size, height: size, fontSize: size * 0.48, '--h': hueFor(id) }}>
      {initial}
    </span>
  )
}
