const getAppApiBase = () => {
  const app = getApp && getApp()
  const base = app && app.globalData ? String(app.globalData.apiBase || '').trim() : ''
  return base
}

const requestJson = (url, payload) =>
  new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data: payload,
      header: { 'content-type': 'application/json' },
      timeout: 8000,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })

const callMpApi = async (action, data) => {
  const base = getAppApiBase()
  if (base) {
    const app = getApp && getApp()
    const userId = app && app.globalData ? String(app.globalData.userId || app.globalData.openid || '').trim() : ''
    const url = `${base.replace(/\/+$/, '')}/api/mp/rpc`
    try {
      const res = await requestJson(url, { action, data: { ...(data || {}), userId } })
      const body = (res && res.data) || null
      if (!body) throw new Error('请求失败')
      if (body && body.error) throw new Error(body.error)
      return { result: body }
    } catch (e) {
      return wx.cloud.callFunction({
        name: 'mpApi',
        data: { action, data }
      })
    }
  }

  return wx.cloud.callFunction({
    name: 'mpApi',
    data: { action, data }
  })
}

module.exports = {
  callMpApi
}
