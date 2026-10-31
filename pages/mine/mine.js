const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    stats: { orderCount: 0, doneCount: 0, spentText: '0' },
    shop: { name: '拾味小馆', phone: '' },
    version: '1.0.0'
  },

  onShow() {
    this.setData({
      stats: store.userStats(),
      shop: store.getSettings()
    })
  },

  onOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  },

  onAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  onCall() {
    wx.makePhoneCall({
      phoneNumber: this.data.shop.phone,
      fail: function () {}
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于拾味小馆',
      content:
        '一个用于演示的线上点餐小程序：顾客端可浏览菜单、选规格、加购物车、下单并查看订单进度；商家端可管理菜品、处理订单、开关门店。数据保存在本地缓存中。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#F4511E'
    })
  },

  onReset() {
    const that = this
    wx.showModal({
      title: '重置演示数据',
      content: '将清空本地订单、购物车与菜品修改，恢复到初始菜单。确定继续吗？',
      confirmText: '重置',
      confirmColor: '#E5484D',
      success: function (res) {
        if (!res.confirm) return
        store.resetAll()
        that.setData({ stats: store.userStats() })
        wx.showToast({ title: '已恢复初始数据', icon: 'none' })
      }
    })
  }
})
