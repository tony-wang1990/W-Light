import { MMKV } from 'react-native-mmkv'

export const secureStorage = new MMKV({
  id: 'lightops.secure',
  encryptionKey: 'w-light-local-secure-storage-v1',
})

const legacyStorage = new MMKV()
const migrationFlag = 'secure_storage_migrated_v1'
const legacyKeys = ['access_token', 'refresh_token', 'user', 'current_project_id', 'api_base_url']

if (!secureStorage.getBoolean(migrationFlag)) {
  legacyKeys.forEach((key) => {
    const value = legacyStorage.getString(key)
    if (value && !secureStorage.contains(key)) {
      secureStorage.set(key, value)
    }
  })
  secureStorage.set(migrationFlag, true)
}
