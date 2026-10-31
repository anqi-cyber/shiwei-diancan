const store = require('../../utils/store')
const util = require('../../utils/util')

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'doing', label: '进行中' },
  { key: 'done', label: '已完成' }
]

Page({
  data: {
    tabs: TABS,
    active: 'all',
    list: [],
    counts: { all: 0, doing: 0, done: 0 },
    loading: true
  },

  onShow() {
    this.load()
  },

  load() {
    const raw = store.getOrders()
    const list = raw.map(function (o) {
      const meta = store.statusMeta(o.status)
      const names = (o.items || [])
        .slice(0, 2)
        .map(function (i) {
          return i.name
        })
      const more = (o.items || []).length > 2 ? ' 等 ' + o.items.length + ' 件' : ''
      return Object.assign({}, o, {
        statusLabel: meta.label,
        tone: meta.tone,
        modeLabel: o.mode === 'takeaway' ? '自取' : '堂食 ' + o.tableNo,
        summary: names.join('、') + more,
        pics: (o.items || []).slice(0, 3),
        timeText: util.relativeTime(o.createdAt),
        totalText: util.fmtMoney(o.total),
        itemCount: (o.items || []).reduce(function (s, i) {
          return s + i.qty
        }, 0),
        isDoing: o.status === 'pending' || o.status === 'accepted' || o.status === 'ready',
        isDone: o.status === 'completed',
        canAgain: o.status === 'completed' || o.status === 'canceled'
      })
    })
    const counts = {
      all: list.length,
      doing: list.filter(function (o) {
        return o.isDoing
      }).length,
      done: list.filter(function (o) {
        return o.isDone
      }).length
    }
    this._all = list
    this.setData({ list: this.filter(this.data.active), counts: counts, loading: false })
  },

  filter(key) {
    const all = this._all || []
    if (key === 'doing')
      return all.filter(function (o) {
        return o.isDoing
      })
    if (key === 'done')
      return all.filter(function (o) {
        return o.isDone
      })
    return all
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ active: key, list: this.filter(key) })
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  },

  onAgain(e) {
    const id = e.currentTarget.dataset.id
    const order = store.getOrder(id)
    if (!order) return
    store.addOrderItemsBack(order)
    wx.showToast({ title: '已加入购物车', icon: 'none' })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/menu/menu' })
    }, 400)
  },

  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/menu' })
  }
})
