const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    order: null,
    items: [],
    steps: [],
    meta: { label: '', desc: '', tone: 'warn' },
    heroClass: 'warm',
    actionMode: 'doing',
    modeLabel: '',
    createdAtText: '',
    missing: false,
    isNew: false,
    canCancel: false
  },

  onLoad(query) {
    this.id = query.id
    this.isNew = query.new === '1'
  },

  onShow() {
    this.load()
    this.startPoll()
  },

  onHide() {
    this.stopPoll()
  },

  onUnload() {
    this.stopPoll()
  },

  load() {
    const order = store.getOrder(this.id)
    if (!order) {
      this.setData({ missing: true })
      this.stopPoll()
      return
    }
    const steps = store.buildSteps(order)
    const meta = store.statusMeta(order.status)
    let heroClass = 'warm'
    if (order.status === 'ready') heroClass = 'green'
    else if (order.status === 'completed' || order.status === 'canceled') heroClass = 'grey'

    let actionMode = 'doing'
    if (order.status === 'pending') actionMode = 'pending'
    else if (order.status === 'completed' || order.status === 'canceled') actionMode = 'done'

    const items = (order.items || []).map(function (i) {
      return Object.assign({}, i, { lineText: util.fmtMoney(i.unitPrice * i.qty) })
    })

    this.setData({
      order: order,
      items: items,
      steps: steps,
      meta: meta,
      heroClass: heroClass,
      actionMode: actionMode,
      modeLabel:
        order.mode === 'takeaway' ? '到店自取' : '堂食 · ' + (order.tableNo || '大厅'),
      createdAtText: util.formatFull(order.createdAt),
      subtotalText: util.fmtMoney(order.subtotal),
      packingFeeText: util.fmtMoney(order.packingFee),
      discountText: util.fmtMoney(order.discount),
      totalText: util.fmtMoney(order.total),
      canCancel: order.status === 'pending',
      isNew: this.isNew && order.status === 'pending'
    })

    if (this.isNew) {
      this.isNew = false
      wx.showToast({ title: '下单成功', icon: 'success' })
    }

    if (order.status === 'completed' || order.status === 'canceled') this.stopPoll()
  },

  startPoll() {
    const that = this
    this.stopPoll()
    const order = this.data.order
    if (!order) return
    if (order.status === 'completed' || order.status === 'canceled') return
    this._timer = setInterval(function () {
      that.load()
    }, 5000)
  },

  stopPoll() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  onCopyNo() {
    wx.setClipboardData({
      data: this.data.order.no,
      success: function () {
        wx.showToast({ title: '订单号已复制', icon: 'none' })
      }
    })
  },

  onCancel() {
    const that = this
    wx.showModal({
      title: '取消订单',
      content: '取消后需要重新点餐，确定要取消吗？',
      confirmText: '确定取消',
      confirmColor: '#E5484D',
      success: function (res) {
        if (!res.confirm) return
        store.updateOrderStatus(that.id, 'canceled')
        that.load()
        wx.showToast({ title: '订单已取消', icon: 'none' })
      }
    })
  },

  onAgain() {
    const order = this.data.order
    if (!order) return
    store.addOrderItemsBack(order)
    wx.showToast({ title: '已加入购物车', icon: 'none' })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/menu/menu' })
    }, 400)
  },

  onCall() {
    wx.makePhoneCall({
      phoneNumber: store.getSettings().phone,
      fail: function () {
        // 用户取消拨号时静默处理
      }
    })
  },

  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  onGoOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  }
})
