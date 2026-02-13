Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/tabs/home/index', text: '首页' },
      { pagePath: 'pages/tabs/works/index', text: '作品' },
      { pagePath: 'pages/tabs/bookings/index', text: '预约' },
      { pagePath: 'pages/tabs/me/index', text: '我的' }
    ]
  },
  methods: {
    onChange(e) {
      const path = e.currentTarget.dataset.path
      wx.switchTab({ url: `/${path}` })
    }
  }
})

