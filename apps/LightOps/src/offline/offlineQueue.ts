import apiClient from '../api/client'
import { secureStorage } from '../storage/secureStorage'

type OfflineMethod = 'post' | 'put' | 'patch' | 'delete'

export type OfflineOperationType = 'create-order' | 'add-repair-log'

export interface OfflineQueueItem {
  id: string
  type: OfflineOperationType
  title: string
  endpoint: string
  method: OfflineMethod
  body?: unknown
  createdAt: string
  attemptCount: number
  lastTriedAt?: string
  lastError?: string
  hasConflict?: boolean
}

export interface OfflineQueueSummary {
  total: number
  conflicts: number
  lastCreatedAt?: string
  lastError?: string
}

export interface OfflineSyncResult {
  total: number
  synced: number
  failed: number
  pending: number
  conflicts: number
  lastError?: string
}

const queueKey = 'offline_sync_queue_v1'

function createQueueId() {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Sync failed'
}

function isConflictMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('conflict')
    || normalized.includes('409')
    || message.includes('冲突')
    || message.includes('库存')
}

function readQueue(): OfflineQueueItem[] {
  const raw = secureStorage.getString(queueKey)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    secureStorage.delete(queueKey)
    return []
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  if (items.length === 0) {
    secureStorage.delete(queueKey)
    return
  }

  secureStorage.set(queueKey, JSON.stringify(items))
}

export function isLikelyOfflineError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('network')
    || message.includes('timeout')
    || message.includes('offline')
    || message.includes('网络')
    || message.includes('超时')
}

export function getOfflineQueue() {
  return readQueue()
}

export function removeOfflineQueueItem(id: string) {
  const queue = readQueue()
  writeQueue(queue.filter(item => item.id !== id))
}

export function getOfflineQueueSummary(): OfflineQueueSummary {
  const queue = readQueue()
  return {
    total: queue.length,
    conflicts: queue.filter(item => item.hasConflict).length,
    lastCreatedAt: queue[queue.length - 1]?.createdAt,
    lastError: queue.find(item => item.lastError)?.lastError,
  }
}

export function enqueueOfflineRequest(input: {
  type: OfflineOperationType
  title: string
  endpoint: string
  method: OfflineMethod
  body?: unknown
}) {
  const item: OfflineQueueItem = {
    id: createQueueId(),
    type: input.type,
    title: input.title,
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
    createdAt: new Date().toISOString(),
    attemptCount: 0,
  }

  const queue = readQueue()
  writeQueue([...queue, item])
  return item
}

async function sendQueuedItem(item: OfflineQueueItem) {
  switch (item.method) {
    case 'post':
      return apiClient.post(item.endpoint, item.body)
    case 'put':
      return apiClient.put(item.endpoint, item.body)
    case 'patch':
      return apiClient.patch(item.endpoint, item.body)
    case 'delete':
      return apiClient.delete(item.endpoint)
    default:
      throw new Error(`Unsupported offline method: ${item.method}`)
  }
}

export async function syncOfflineQueue(): Promise<OfflineSyncResult> {
  const queue = readQueue()
  const failedItems: OfflineQueueItem[] = []
  let synced = 0

  for (const item of queue) {
    try {
      await sendQueuedItem(item)
      synced += 1
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      failedItems.push({
        ...item,
        attemptCount: item.attemptCount + 1,
        lastTriedAt: new Date().toISOString(),
        lastError: message,
        hasConflict: isConflictMessage(message),
      })
    }
  }

  writeQueue(failedItems)

  return {
    total: queue.length,
    synced,
    failed: failedItems.length,
    pending: failedItems.length,
    conflicts: failedItems.filter(item => item.hasConflict).length,
    lastError: failedItems[0]?.lastError,
  }
}
