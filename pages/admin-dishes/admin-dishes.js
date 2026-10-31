const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    cats: [],
    activeCat: 'all',
    list: [],
    total: 0,
    onSale: 0
  },

  onShow() {
    this.load()
  },

  load() {
    const cats = [{ id: 'all', name: '全部' }].concat(
      store.getCategories().map(function (c) {
        return { id: c.id, name: c.name }
      })
    )
    const raw = store.getRawDishes()
    const activeCat = this.data.activeCat
    const list = raw
      .filter(function (d) {
        return activeCat === 'all' || d.cat === activeCat
      })
      .map(function (d) {
        return {
          id: d.id,
          name: d.name,
          emoji: d.emoji,
          bg: d.bg,
          priceText: util.fmtMoney(d.price),
          catName: store.categoryName(d.cat),
          sales: d.sales || 0,
          isOn: d.status === 'on',
          specHint: (d.specs || []).length ? '多规格' : '单规格',
          tags: (d.tags || []).join(' · ')
        }
      })
    this.setData({
      cats: cats,
      list: list,
      total: raw.length,
      onSale: raw.filter(function (d) {
        return d.status === 'on'
      }).length
    })
  },

  onFilter(e) {
    this.setData({ activeCat: e.currentTarget.dataset.id }, function () {
      this.load()
    }.bind(this))
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    const value = e.detail.value
    store.setDishStatus(id, value ? 'on' : 'off')
    this.load()
    wx.showToast({ title: value ? '已上架' : '已下架', icon: 'none' })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/admin-dish-edit/admin-dish-edit?id=' + id })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/admin-dish-edit/admin-dish-edit' })
  },

  noop() {}
})
