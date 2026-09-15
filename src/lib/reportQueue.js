const QUEUE_KEY = 'sijaka-report-queue'

function readQueue() {
  try {
    const value = window.localStorage.getItem(QUEUE_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
  }
}

export function enqueueReport(report) {
  const queue = readQueue()
  const queuedReport = {
    ...report,
    queued_at: new Date().toISOString(),
  }
  writeQueue([...queue, queuedReport])
}

export function getQueuedReports(userId) {
  return readQueue().filter((report) => report.user_id === userId)
}

export function removeQueuedReport(queuedAt) {
  writeQueue(readQueue().filter((report) => report.queued_at !== queuedAt))
}

export function getQueuedReportCount(userId) {
  return getQueuedReports(userId).length
}
