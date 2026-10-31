const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    shop: {
      name: '拾味小馆',
      branch: '',
      rating: 5,
      monthSales: 0,
      notice: '',
      hours: '',
      isOpen: true,
      tables: [],
      packingFee: 0,
      discountThreshold: 50,
      discountAmount: 5
    },
    modes: [
      { key: 'dinein', label: '堂食' },
      { key: 'takeaway', label: '自取' }
    ],
    mode: 'dinein',
    tableIndex: 0,
    tableNo: '',
    pickupMinutes: 20,
    sections: [],
    activeCat: '',
    scrollInto: '',
    cartItems: [],
    cartCount: 0,
    cartAmountText: '0',
    cartTip: '',
    showCart: false,
    showSpec: false,
    bump: false,
    dish: null,
    specSelections: [],
    specQty: 1,
    specPrice: 0,
    specPriceText: '0',
    specText: ''
  },

  onLoad() {
    const settings = store.getSettings()
    const sections = this.buildSections()
    let tableIndex = 2
    if (tableIndex > settings.tables.length - 1) tableIndex = 0
    this.setData({
      shop: settings,
      sections,
      tableIndex: tableIndex,
      tableNo: settings.tables[tableIndex] || '',
      activeCat: sections.length ? sections[0].id : ''
    })
    this.refreshCart()
  },

  onShow() {
    this.reload()
    this.setData({ showCart: false, showSpec: false })
    const that = this
    wx.nextTick(function () {
      that.measureSections()
    })
  },

  onReady() {
    this.measureSections()
  },

  onUnload() {
    if (this._bumpTimer) clearTimeout(this._bumpTimer)
  },

  reload() {
    const settings = store.getSettings()
    const sections = this.buildSections()
    const keep = sections.some(
      function (s) {
        return s.id === this.data.activeCat
      }.bind(this)
    )
    this.setData({
      shop: settings,
      sections: sections,
      activeCat: keep ? this.data.activeCat : sections.length ? sections[0].id : ''
    })
    this.refreshCart()
  },

  buildSections() {
    const cats = store.getCategories()
    const dishes = store.getDishes().filter(function (d) {
      return d.status === 'on'
    })
    return cats
      .map(function (c) {
        const list = dishes.filter(function (d) {
          return d.cat === c.id
        })
        return {
          id: c.id,
          name: c.name,
          sub: list.length + ' 道',
          dishes: list
        }
      })
      .filter(function (s) {
        return s.dishes.length > 0
      })
  },

  refreshCart() {
    const cart = store.getCart()
    const sum = store.summarize(cart)
    const qtyMap = {}
    cart.forEach(function (i) {
      qtyMap[i.dishId] = (qtyMap[i.dishId] || 0) + i.qty
    })
    const sections = this.data.sections.map(function (sec) {
      return Object.assign({}, sec, {
        dishes: sec.dishes.map(function (d) {
          return Object.assign({}, d, { qty: qtyMap[d.id] || 0 })
        })
      })
    })
    const setting = this.data.shop
    let tip = ''
    if (sum.count > 0 && this.data.mode === 'takeaway') {
      tip = '另需打包费 ¥' + util.fmtMoney(setting.packingFee)
    }
    this.setData({
      cartItems: cart,
      cartCount: sum.count,
      cartAmountText: util.fmtMoney(sum.amount),
      sections: sections,
      cartTip: tip,
      showCart: sum.count > 0 ? this.data.showCart : false
    })
  },

  /* ---------------- 分类与滚动联动 ---------------- */

  measureSections() {
    if (!this.data.sections.length) return
    const that = this
    const q = wx.createSelectorQuery()
    q.select('.js-list').boundingClientRect()
    q.selectAll('.js-section').boundingClientRect()
    q.exec(function (res) {
      const list = res[0]
      const secs = res[1] || []
      if (!list || !secs.length) return
      that._offsets = secs.map(function (s) {
        return Math.max(0, s.top - list.top)
      })
    })
  },

  onListScroll(e) {
    const st = e.detail.scrollTop
    this._scrollTop = st
    if (this._lockUntil && Date.now() < this._lockUntil) return
    const offsets = this._offsets
    if (!offsets || !offsets.length) return
    let idx = 0
    for (let i = 0; i < offsets.length; i++) {
      if (st >= offsets[i] - 12) idx = i
    }
    const sec = this.data.sections[idx]
    if (sec && sec.id !== this.data.activeCat) {
      this.setData({ activeCat: sec.id })
    }
  },

  onCatTap(e) {
    const id = e.currentTarget.dataset.id
    this._lockUntil = Date.now() + 600
    this.setData({ activeCat: id, scrollInto: '' }, function () {
      this.setData({ scrollInto: 'sec-' + id })
    }.bind(this))
  },

  /* ---------------- 门店 / 就餐方式 ---------------- */

  onModeTap(e) {
    const mode = e.currentTarget.dataset.key
    if (mode === this.data.mode) return
    this.setData({ mode: mode })
    this.refreshCart()
  },

  onTableChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      tableIndex: idx,
      tableNo: this.data.shop.tables[idx] || ''
    })
  },

  onNoticeTap() {
    wx.showModal({
      title: '门店公告',
      content: this.data.shop.notice,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#F4511E'
    })
  },

  /* ---------------- 加购 ---------------- */

  guard() {
    if (!this.data.shop.isOpen) {
      wx.showToast({ title: '门店休息中，暂不接单', icon: 'none' })
      return false
    }
    return true
  },

  bumpCart() {
    const that = this
    this.setData({ bump: true })
    if (this._bumpTimer) clearTimeout(this._bumpTimer)
    this._bumpTimer = setTimeout(function () {
      that.setData({ bump: false })
    }, 320)
  },

  onAddTap(e) {
    if (!this.guard()) return
    const dish = store.getDishById(e.currentTarget.dataset.id)
    if (!dish) return
    store.addToCart(dish, '', dish.price, 1)
    this.refreshCart()
    this.bumpCart()
  },

  onMinusTap(e) {
    const id = e.currentTarget.dataset.id
    const cart = store.getCart()
    const item = cart.filter(function (i) {
      return i.dishId === id && !i.specText
    })[0]
    if (!item) return
    store.changeQty(item.key, -1)
    this.refreshCart()
  },

  /* ---------------- 规格弹窗 ---------------- */

  onSpecTap(e) {
    if (!this.guard()) return
    const dish = store.getDishById(e.currentTarget.dataset.id)
    if (!dish) return
    const selections = (dish.specs || []).map(function () {
      return 0
    })
    this.setData(
      {
        dish: dish,
        specSelections: selections,
        specQty: 1,
        showSpec: true
      },
      function () {
        this.updateSpecPrice()
      }.bind(this)
    )
  },

  updateSpecPrice() {
    const dish = this.data.dish
    if (!dish) return
    const selections = this.data.specSelections
    let price = dish.price
    const parts = []
    ;(dish.specs || []).forEach(function (opt, oi) {
      const v = opt.values[selections[oi]] || opt.values[0]
      price += v.delta || 0
      parts.push(v.label)
    })
    this.setData({
      specPrice: price,
      specPriceText: util.fmtMoney(price),
      specText: parts.join(' · ')
    })
  },

  onSpecChoose(e) {
    const oi = Number(e.currentTarget.dataset.oi)
    const vi = Number(e.currentTarget.dataset.vi)
    const patch = {}
    patch['specSelections[' + oi + ']'] = vi
    this.setData(patch, function () {
      this.updateSpecPrice()
    }.bind(this))
  },

  onSpecMinus() {
    if (this.data.specQty <= 1) return
    this.setData({ specQty: this.data.specQty - 1 })
  },

  onSpecPlus() {
    if (this.data.specQty >= 99) return
    this.setData({ specQty: this.data.specQty + 1 })
  },

  onSpecAdd() {
    const dish = this.data.dish
    if (!dish) return
    store.addToCart(dish, this.data.specText, this.data.specPrice, this.data.specQty)
    this.setData({ showSpec: false, dish: null })
    this.refreshCart()
    this.bumpCart()
    wx.showToast({ title: '已加入购物车', icon: 'none', duration: 800 })
  },

  onSpecClose() {
    this.setData({ showSpec: false })
  },

  /* ---------------- 购物车面板 ---------------- */

  onCartToggle() {
    if (!this.data.cartCount) {
      wx.showToast({ title: '还没选菜哦', icon: 'none' })
      return
    }
    this.setData({ showCart: !this.data.showCart })
  },

  onMaskTap() {
    this.setData({ showCart: false, showSpec: false })
  },

  onCartPlus(e) {
    store.changeQty(e.currentTarget.dataset.key, 1)
    this.refreshCart()
  },

  onCartMinus(e) {
    store.changeQty(e.currentTarget.dataset.key, -1)
    this.refreshCart()
  },

  onClearCart() {
    const that = this
    wx.showModal({
      title: '清空购物车',
      content: '确定要清空已选的全部菜品吗？',
      confirmText: '清空',
      confirmColor: '#E5484D',
      success: function (res) {
        if (!res.confirm) return
        store.clearCart()
        that.setData({ showCart: false })
        that.refreshCart()
      }
    })
  },

  onCheckout() {
    if (!this.data.cartCount) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }
    if (!this.guard()) return
    const mode = this.data.mode
    const table = encodeURIComponent(this.data.tableNo || '')
    wx.navigateTo({
      url: '/pages/confirm/confirm?mode=' + mode + '&table=' + table
    })
  },

  onShareAppMessage() {
    return {
      title: '拾味小馆 · 现点现炒的家常味',
      path: '/pages/menu/menu'
    }
  }
})
