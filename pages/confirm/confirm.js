const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    mode: 'dinein',
    modeLabel: '堂食',
    tableNo: '',
    tableIndex: 0,
    tables: [],
    people: 2,
    remark: '',
    quickTags: ['不要辣', '少油少盐', '不要香菜', '打包餐具', '儿童餐具'],
    items: [],
    subtotalText: '0',
    packingFeeUnit: 0,
    packingFee: 0,
    packingFeeText: '0',
    discount: 0,
    discountText: '0',
    total: 0,
    totalText: '0',
    gapText: '',
    threshold: 50,
    discountAmount: 5,
    submitting: false
  },

  onLoad(query) {
    const cart = store.getCart()
    if (!cart.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
      return
    }
    const settings = store.getSettings()
    const mode = query.mode === 'takeaway' ? 'takeaway' : 'dinein'
    let tableNo = ''
    try {
      tableNo = decodeURIComponent(query.table || '')
    } catch (e) {
      tableNo = ''
    }
    let tableIndex = settings.tables.indexOf(tableNo)
    if (tableIndex < 0) tableIndex = 0
    if (!tableNo) tableNo = settings.tables[0] || ''
    this.setData({
      mode: mode,
      modeLabel: mode === 'takeaway' ? '自取' : '堂食',
      tableNo: tableNo,
      tableIndex: tableIndex,
      tables: settings.tables,
      items: cart,
      threshold: settings.discountThreshold,
      discountAmount: settings.discountAmount,
      packingFeeUnit: settings.packingFee
    })
    this.compute()
  },

  compute() {
    const items = this.data.items
    const subtotal = items.reduce(function (s, i) {
      return s + i.unitPrice * i.qty
    }, 0)
    const packingFee = this.data.mode === 'takeaway' ? this.data.packingFeeUnit : 0
    const discount = subtotal >= this.data.threshold ? this.data.discountAmount : 0
    const total = subtotal + packingFee - discount
    const gap = this.data.threshold - subtotal
    this.setData({
      subtotalText: util.fmtMoney(subtotal),
      packingFee: packingFee,
      packingFeeText: util.fmtMoney(packingFee),
      discount: discount,
      discountText: util.fmtMoney(discount),
      total: total,
      totalText: util.fmtMoney(total),
      gapText: gap > 0 ? '再点 ¥' + util.fmtMoney(gap) + ' 可减 ¥' + this.data.discountAmount : ''
    })
  },

  onModeTap(e) {
    const mode = e.currentTarget.dataset.key
    if (mode === this.data.mode) return
    this.setData({ mode: mode, modeLabel: mode === 'takeaway' ? '自取' : '堂食' })
    this.compute()
  },

  onTableChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ tableIndex: idx, tableNo: this.data.tables[idx] || '' })
  },

  onPeopleMinus() {
    if (this.data.people <= 1) return
    this.setData({ people: this.data.people - 1 })
  },

  onPeoplePlus() {
    if (this.data.people >= 12) return
    this.setData({ people: this.data.people + 1 })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  onQuickTag(e) {
    const label = e.currentTarget.dataset.label
    const tags = (this.data.remark || '')
      .split('，')
      .map(function (t) {
        return t.trim()
      })
      .filter(Boolean)
    const idx = tags.indexOf(label)
    if (idx >= 0) tags.splice(idx, 1)
    else tags.push(label)
    this.setData({ remark: tags.join('，') })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (this.data.mode === 'dinein' && !this.data.tableNo) {
      wx.showToast({ title: '请选择桌号', icon: 'none' })
      return
    }
    if (!store.getSettings().isOpen) {
      wx.showToast({ title: '门店休息中，暂不接单', icon: 'none' })
      return
    }
    const that = this
    this.setData({ submitting: true })
    wx.showLoading({ title: '正在提交', mask: true })
    setTimeout(function () {
      const order = store.createOrder({
        mode: that.data.mode,
        tableNo: that.data.mode === 'dinein' ? that.data.tableNo : '',
        people: that.data.people,
        remark: that.data.remark,
        items: that.data.items,
        packingFee: that.data.packingFee,
        discount: that.data.discount
      })
      store.clearCart()
      wx.hideLoading()
      that.setData({ submitting: false })
      wx.redirectTo({
        url: '/pages/order-detail/order-detail?id=' + order.id + '&new=1'
      })
    }, 650)
  }
})
