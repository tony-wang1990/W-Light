export function normalizeDateRange(startDate?: string, endDate?: string) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const end = endDate || new Date().toISOString().slice(0, 10)
  return {
    start: start.length === 10 ? `${start} 00:00:00` : start,
    end: end.length === 10 ? `${end} 23:59:59` : end,
  }
}
