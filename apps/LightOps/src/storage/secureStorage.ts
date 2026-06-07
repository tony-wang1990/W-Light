import * as Keychain from 'react-native-keychain'
import { MMKV } from 'react-native-mmkv'

type MMKVValue = boolean | string | number | Uint8Array | ArrayBuffer
type MMKVListener = (key: string) => void
type MMKVCompat = MMKV & {
  size?: number
  isReadOnly?: boolean
  trim?: () => void
}

const secureStorageId = 'lightops.secure'
const bootstrapStorageId = 'lightops.bootstrap'
const keychainService = 'com.wlight.lightops.mmkv'
const keychainAccount = 'lightops.secure'
const systemKeyReadyFlag = 'secure_storage_system_key_ready_v1'
const legacyMigrationFlag = 'secure_storage_migrated_v1'
const keySourceKey = 'secure_storage_key_source'
const fallbackSource = 'fallback-mmkv-key'
const systemSource = 'keychain-keystore'

// The first value is the previous MVP key. The second is its 16-byte prefix for
// native MMKV builds that reject longer keys.
const legacyEncryptionKeys = ['w-light-local-secure-storage-v1', 'w-light-local-se']
const fallbackEncryptionKey = legacyEncryptionKeys[1]
const keyAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const legacyKeys = [
  'access_token',
  'refresh_token',
  'user',
  'current_project_id',
  'api_base_url',
]

let activeStorage: MMKV | null = null
let initializePromise: Promise<void> | null = null

const bootstrapStorage = new MMKV({ id: bootstrapStorageId })

function createStorage(encryptionKey: string) {
  return new MMKV({
    id: secureStorageId,
    encryptionKey,
  })
}

function createLegacyStorage() {
  for (const encryptionKey of legacyEncryptionKeys) {
    try {
      return createStorage(encryptionKey)
    } catch {
      // Try the next legacy key candidate.
    }
  }

  return createStorage(fallbackEncryptionKey)
}

function getStorage() {
  if (!activeStorage) {
    activeStorage = createLegacyStorage()
    migrateLegacyDefaultKeys(activeStorage)
  }

  return activeStorage
}

function normalizeValue(value: MMKVValue) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  return value
}

function randomByteValues(length: number) {
  const bytes = new Uint8Array(length)
  const crypto = (globalThis as unknown as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto

  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes)
    return bytes
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }

  return bytes
}

function generateMmkvEncryptionKey() {
  const bytes = randomByteValues(16)

  return Array.from(bytes)
    .map(byte => keyAlphabet[byte % keyAlphabet.length])
    .join('')
}

async function getOrCreateSystemEncryptionKey() {
  const credentials = await Keychain.getGenericPassword({ service: keychainService })

  if (credentials && credentials.password.length === 16) {
    return credentials.password
  }

  const encryptionKey = generateMmkvEncryptionKey()
  const result = await Keychain.setGenericPassword(keychainAccount, encryptionKey, {
    service: keychainService,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  })

  if (!result) {
    throw new Error('Unable to store MMKV encryption key in Keychain/Keystore')
  }

  return encryptionKey
}

function migrateLegacyDefaultKeys(storage: MMKV) {
  if (storage.getBoolean(legacyMigrationFlag)) return

  const legacyStorage = new MMKV()

  legacyKeys.forEach(key => {
    const value = legacyStorage.getString(key)
    if (value && !storage.contains(key)) {
      storage.set(key, value)
    }
  })

  storage.set(legacyMigrationFlag, true)
}

async function initializeWithSystemKey() {
  const systemEncryptionKey = await getOrCreateSystemEncryptionKey()

  if (bootstrapStorage.getBoolean(systemKeyReadyFlag)) {
    activeStorage = createStorage(systemEncryptionKey)
    migrateLegacyDefaultKeys(activeStorage)
    activeStorage.set(keySourceKey, systemSource)
    return
  }

  const storage = activeStorage ?? createLegacyStorage()
  migrateLegacyDefaultKeys(storage)
  storage.recrypt(systemEncryptionKey)
  storage.set(keySourceKey, systemSource)
  activeStorage = storage
  bootstrapStorage.set(systemKeyReadyFlag, true)
}

export function initializeSecureStorageEncryption() {
  if (!initializePromise) {
    initializePromise = initializeWithSystemKey().catch(error => {
      console.warn('[LightOps] Falling back to local MMKV encryption key:', error)
      activeStorage = createLegacyStorage()
      migrateLegacyDefaultKeys(activeStorage)
      activeStorage.set(keySourceKey, fallbackSource)
    })
  }

  return initializePromise
}

export const secureStorage = {
  get size() {
    const storage = getStorage() as MMKVCompat
    return typeof storage.size === 'number' ? storage.size : storage.getAllKeys().length
  },
  get isReadOnly() {
    const storage = getStorage() as MMKVCompat
    return storage.isReadOnly ?? false
  },
  set(key: string, value: MMKVValue) {
    getStorage().set(key, normalizeValue(value))
  },
  getBoolean(key: string) {
    return getStorage().getBoolean(key)
  },
  getString(key: string) {
    return getStorage().getString(key)
  },
  getNumber(key: string) {
    return getStorage().getNumber(key)
  },
  getBuffer(key: string) {
    return getStorage().getBuffer(key)
  },
  contains(key: string) {
    return getStorage().contains(key)
  },
  delete(key: string) {
    getStorage().delete(key)
  },
  getAllKeys() {
    return getStorage().getAllKeys()
  },
  clearAll() {
    getStorage().clearAll()
  },
  recrypt(key: string | undefined) {
    getStorage().recrypt(key)
  },
  trim() {
    ;(getStorage() as MMKVCompat).trim?.()
  },
  toString() {
    return getStorage().toString()
  },
  toJSON() {
    return getStorage().toJSON()
  },
  addOnValueChangedListener(onValueChanged: MMKVListener) {
    return getStorage().addOnValueChangedListener(onValueChanged)
  },
}
