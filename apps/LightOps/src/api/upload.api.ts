import { launchImageLibrary, type Asset, type MediaType } from 'react-native-image-picker'
import client from './client'

export interface UploadedMedia {
  url: string
  name: string
  mimeType: string
  mediaType: 'image' | 'video'
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
  const formData = new FormData()

  formData.append('file', {
    uri: asset.uri,
    type: mimeType,
    name: getAssetName(asset),
  } as unknown as Blob)

  const response = await client.post<{ url: string }>(
    `/upload/${mediaType}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )

  return {
    url: response.url,
    name: getAssetName(asset),
    mimeType,
    mediaType,
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
    return Promise.all(assets.map(uploadAsset))
  },
}
