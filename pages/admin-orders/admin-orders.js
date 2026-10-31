const store = require('../../utils/store')
const util = require('../../utils/util')

const TABS = [
  { key: 'pending', label: '待接单' },
  { key: 'accepted', label: '制作中' },
  { key: 'ready', label: '待取餐' },
  { key: 'all', label: '全部' }
]

Page({
  data: {
    tabs: TABS,
    active: 'pending',
    list: [],
    counts: {}
  },

  onShow() {
    this.load()
  },

  load() {
    const orders = store.getOrders()
    const list = orders.map(function (o) {
      const meta = store.statusMeta(o.status)
      return {
        id: o.id,
        no: o.no,
        shortNo: o.no.slice(-4),
        status: o.status,
        statusLabel: meta.label,
        tone: meta.tone,
        timeText: util.relativeTime(o.createdAt),
        modeLabel: o.mode === 'takeaway' ? '到店自取' : '堂食 · ' + (o.tableNo || '—'),
        people: o.people,
        remark: o.remark,
        items: o.items || [],
        totalText: util.fmtMoney(o.total),
        canAccept: o.status === 'pending',
        canReady: o.status === 'accepted',
        canComplete: o.status === 'ready',
        canCancel: o.status === 'pending' || o.status === 'accepted'
      }
    })
    this._all = list
    const counts = {}
    TABS.forEach(function (t) {
      counts[t.key] =
        t.key === 'all'
          ? list.length
          : list.filter(function (o) {
              return o.status === t.key
            }).length
    })
    this.setData({ list: this.filter(this.data.active), counts: counts })
  },

  filter(key) {
    const all = this._all || []
    if (key === 'all') return all
    return all.filter(function (o) {
      return o.status === key
    })
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ active: key, list: this.filter(key) })
  },

  onAccept(e) {
    const id = e.currentTarget.dataset.id
    store.updateOrderStatus(id, 'accepted')
    this.load()
    wx.showToast({ title: '已接单', icon: 'none' })
  },

  onReady(e) {
    const id = e.currentTarget.dataset.id
    store.updateOrderStatus(id, 'ready')
    this.load()
    wx.showToast({ title: '已出餐，等待取餐', icon: 'none' })
  },

  onComplete(e) {
    const id = e.currentTarget.dataset.id
    store.updateOrderStatus(id, 'completed')
    this.load()
    wx.showToast({ title: '订单已完成', icon: 'none' })
  },

  onCancel(e) {
    const that = this
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消订单',
      content: '取消后顾客会看到「已取消」，确定吗？',
      confirmText: '确定取消',
      confirmColor: '#E5484D',
      success: function (res) {
        if (!res.confirm) return
        store.updateOrderStatus(id, 'canceled')
        that.load()
        wx.showToast({ title: '订单已取消', icon: 'none' })
      }
    })
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  }
})
