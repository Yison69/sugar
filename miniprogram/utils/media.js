const cache = new Map()

const isCloudFileId = (v) => typeof v === 'string' && v.startsWith('cloud://')

const resolveTempUrls = async (fileIds) => {
  const uniq = Array.from(new Set((fileIds || []).filter(isCloudFileId)))
  const pending = uniq.filter((id) => !cache.has(id))
  if (pending.length) {
    const res = await wx.cloud
      .getTempFileURL({
        fileList: pending.map((fileID) => ({ fileID, maxAge: 3600 }))
      })
      .catch(() => null)
    const list = (res && res.fileList) || []
    for (const it of list) {
      if (it && it.fileID && it.tempFileURL) cache.set(it.fileID, it.tempFileURL)
    }
  }
  return (fileIds || []).map((u) => (isCloudFileId(u) ? cache.get(u) || u : u))
}

module.exports = {
  resolveTempUrls,
  isCloudFileId
}

