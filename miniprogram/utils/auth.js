const STORAGE_KEY = 'mp_login_state_v1'

const encode = encodeURIComponent

function isMpLoggedIn() {
  try {
    const v = wx.getStorageSync(STORAGE_KEY)
    return !!(v && v.username)
  } catch (_) {
    return false
  }
}

function getMpLoginUser() {
  try {
    const v = wx.getStorageSync(STORAGE_KEY) || {}
    return String(v.username || '').trim()
  } catch (_) {
    return ''
  }
}

function setMpLoggedIn(username) {
  try {
    wx.setStorageSync(STORAGE_KEY, {
      username: String(username || '').trim(),
      loginAt: Date.now()
    })
  } catch (_) {}
}

function clearMpLoggedIn() {
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (_) {}
}

function buildPageUrl(page) {
  if (!page || !page.route) return ''
  const path = `/${page.route}`
  const options = page.options || {}
  const keys = Object.keys(options)
  if (!keys.length) return path
  const query = keys
    .filter((k) => options[k] !== undefined && options[k] !== null && String(options[k]) !== '')
    .map((k) => `${encode(k)}=${encode(String(options[k]))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

function ensureMpLogin(page) {
  if (isMpLoggedIn()) return true
  const redirect = buildPageUrl(page)
  const loginUrl = redirect ? `/pages/login/index?redirect=${encode(redirect)}` : '/pages/login/index'
  wx.redirectTo({ url: loginUrl })
  return false
}

function navigateAfterLogin(redirectUrl) {
  const target = String(redirectUrl || '').trim() || '/pages/tabs/home/index'
  if (/^\/pages\/tabs\//.test(target)) {
    wx.switchTab({ url: target })
    return
  }
  wx.reLaunch({ url: target })
}

module.exports = {
  isMpLoggedIn,
  getMpLoginUser,
  setMpLoggedIn,
  clearMpLoggedIn,
  ensureMpLogin,
  navigateAfterLogin
}
