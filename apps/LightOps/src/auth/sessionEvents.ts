type SessionExpiredListener = () => void

const listeners = new Set<SessionExpiredListener>()

export function subscribeSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifySessionExpired() {
  listeners.forEach(listener => listener())
}
