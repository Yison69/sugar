const { callMpApi } = require('../../utils/cloud')
const { isMpLoggedIn, setMpLoggedIn, navigateAfterLogin } = require('../../utils/auth')

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    error: ''
  },
  onLoad(options) {
    this.redirectUrl = ''
    if (options && typeof options.redirect === 'string' && options.redirect) {
      try {
        this.redirectUrl = decodeURIComponent(options.redirect)
      } catch (_) {
        this.redirectUrl = options.redirect
      }
    }
    if (this.redirectUrl.indexOf('/pages/login/index') === 0) {
      this.redirectUrl = ''
    }
  },
  onShow() {
    if (isMpLoggedIn()) {
      navigateAfterLogin(this.redirectUrl)
    }
  },
  onUsernameInput(e) {
    this.setData({ username: e.detail.value || '', error: '' })
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value || '', error: '' })
  },
  submit() {
    if (this.data.loading) return
    const username = String(this.data.username || '').trim()
    const password = String(this.data.password || '')
    if (!username || !password) {
      this.setData({ error: '请输入账号和密码' })
      return
    }

    this.setData({ loading: true, error: '' })
    callMpApi('passwordLogin', { username, password })
      .then((res) => {
        const result = (res && res.result) || {}
        if (result && result.error) throw new Error(result.error)
        setMpLoggedIn(result.username || username)
        this.setData({ password: '' })
        navigateAfterLogin(this.redirectUrl)
      })
      .catch((err) => {
        const message = (err && err.message) || '登录失败'
        this.setData({ error: message })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  }
})
