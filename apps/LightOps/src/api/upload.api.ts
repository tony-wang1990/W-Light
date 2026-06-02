import { launchImageLibrary, type Asset, type MediaType } from 'react-native-image-picker'
import client from './client'

export interface UploadedMedia {
  url?: string
  localUri?: string
  name: string
  mimeType: string
  mediaType: 'image' | 'video'
  pendingUpload?: boolean
  uploadError?: string
}

function getAssetName(asset: Asset) {
  if (asset.fileName) return asset.fileName
  const ext = asset.type?.split('/')[1] || 'jpg'
  return `现场附件-${Date.now()}.${ext}`
}

async function uploadAsset(asset: Asset): Promise<UploadedMedia> {
  if (!asset.uri) throw new Error('未获取到文件地址')

  const mimeType = asset.type || 'image/jpeg'
  const mediaType = mimeType.startsWith('video') ? 'video' : 'image'
  const name = getAssetName(asset)
  const formData = new FormData()

  formData.append('file', {
    uri: asset.uri,
    type: mimeType,
    name,
  } as unknown as Blob)

  const response = await client.post<{ url: string }>(
    `/upload/${mediaType}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )

  return {
    url: response.url,
    localUri: asset.uri,
    name,
    mimeType,
    mediaType,
  }
}

function createPendingMedia(asset: Asset, error?: unknown): UploadedMedia {
  const mimeType = asset.type || 'image/jpeg'
  return {
    localUri: asset.uri,
    name: getAssetName(asset),
    mimeType,
    mediaType: mimeType.startsWith('video') ? 'video' : 'image',
    pendingUpload: true,
    uploadError: error instanceof Error ? error.message : undefined,
  }
}

export const uploadApi = {
  pickAndUpload: async (mediaType: MediaType = 'mixed'): Promise<UploadedMedia[]> => {
    const result = await launchImageLibrary({
      mediaType,
      selectionLimit: 6,
      quality: 0.8,
      videoQuality: 'medium',
    })

    if (result.didCancel) return []
    if (result.errorMessage) throw new Error(result.errorMessage)

    const assets = result.assets || []
    const uploaded: UploadedMedia[] = []
    for (const asset of assets) {
      try {
        uploaded.push(await uploadAsset(asset))
      } catch (error: unknown) {
        uploaded.push(createPendingMedia(asset, error))
      }
    }
    return uploaded
  },

  uploadPendingMedia: async (items: UploadedMedia[]): Promise<UploadedMedia[]> => {
    const uploaded: UploadedMedia[] = []
    for (const item of items) {
      if (item.url || !item.localUri || !item.pendingUpload) {
        uploaded.push(item)
        continue
      }

      uploaded.push(await uploadAsset({
        uri: item.localUri,
        type: item.mimeType,
        fileName: item.name,
      }))
    }
    return uploaded
  },
}
