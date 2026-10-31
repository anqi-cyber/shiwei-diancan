const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    locked: true,
    pin: '',
    pinError: '',
    shop: { name: '', isOpen: true, notice: '', hours: '' },
    stats: { revenueText: '0', todayCount: 0, pending: 0, making: 0, onSale: 0 },
    recent: [],
    showNotice: false,
    noticeDraft: ''
  },

  onShow() {
    if (!this.data.locked) this.load()
  },

  load() {
    const orders = store.getOrders()
    const recent = orders.slice(0, 3).map(function (o) {
      const meta = store.statusMeta(o.status)
      const names = (o.items || [])
        .slice(0, 3)
        .map(function (i) {
          return i.name + '×' + i.qty
        })
      return {
        id: o.id,
        no: o.no,
        statusLabel: meta.label,
        tone: meta.tone,
        timeText: util.relativeTime(o.createdAt),
        totalText: util.fmtMoney(o.total),
        summary: names.join('、'),
        modeLabel: o.mode === 'takeaway' ? '自取' : '堂食 ' + o.tableNo,
        isPending: o.status === 'pending'
      }
    })
    this.setData({
      shop: store.getSettings(),
      stats: store.adminStats(),
      recent: recent
    })
  },

  onPinInput(e) {
    const value = (e.detail.value || '').slice(0, 4)
    this.setData({ pin: value, pinError: '' })
    if (value.length === 4) this.onUnlock()
  },

  onUnlock() {
    const settings = store.getSettings()
    if (this.data.pin !== settings.adminPin) {
      this.setData({ pinError: '密码不正确，请重新输入', pin: '' })
      wx.vibrateShort({ type: 'heavy', fail: function () {} })
      return
    }
    this.setData({ locked: false, pin: '', pinError: '' })
    this.load()
    wx.showToast({ title: '欢迎回来', icon: 'none' })
  },

  onLock() {
    this.setData({ locked: true, pin: '' })
  },

  onToggleOpen(e) {
    const isOpen = e.detail.value
    store.saveSettings({ isOpen: isOpen })
    this.setData({ shop: store.getSettings() })
    wx.showToast({ title: isOpen ? '门店已开始接单' : '门店已暂停接单', icon: 'none' })
  },

  onGoOrders() {
    wx.navigateTo({ url: '/pages/admin-orders/admin-orders' })
  },

  onGoDishes() {
    wx.navigateTo({ url: '/pages/admin-dishes/admin-dishes' })
  },

  onOpenNotice() {
    this.setData({ showNotice: true, noticeDraft: this.data.shop.notice })
  },

  onNoticeInput(e) {
    this.setData({ noticeDraft: e.detail.value })
  },

  onSaveNotice() {
    const text = (this.data.noticeDraft || '').trim()
    if (!text) {
      wx.showToast({ title: '公告不能为空', icon: 'none' })
      return
    }
    store.saveSettings({ notice: text })
    this.setData({ showNotice: false, shop: store.getSettings() })
    wx.showToast({ title: '公告已更新', icon: 'none' })
  },

  onCloseNotice() {
    this.setData({ showNotice: false })
  },

  onAccept(e) {
    const id = e.currentTarget.dataset.id
    store.updateOrderStatus(id, 'accepted')
    this.load()
    wx.showToast({ title: '已接单', icon: 'none' })
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  },

  noop() {}
})
