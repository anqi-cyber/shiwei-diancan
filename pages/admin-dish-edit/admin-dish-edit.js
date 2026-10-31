const store = require('../../utils/store')

const EMOJIS = ['🍖', '🐟', '🥩', '🍲', '🥦', '🍅', '🥔', '🥣', '🌽', '🍚', '🍜', '🍗', '🥒', '🥤', '🍋', '🥟', '🍤', '🍰']
const PALETTES = [
  store.BG.warm,
  store.BG.red,
  store.BG.amber,
  store.BG.cream,
  store.BG.green,
  store.BG.mint,
  store.BG.purple,
  store.BG.lemon,
  store.BG.sand
]

const TAG_OPTIONS = ['招牌', '热销', '微辣', '中辣', '素食']

function buildTagList(selected) {
  return TAG_OPTIONS.map(function (label) {
    return {
      label: label,
      on: (selected || []).indexOf(label) >= 0
    }
  })
}

function detectSpecKey(specs) {
  const names = (specs || [])
    .map(function (s) {
      return s.name
    })
    .join(',')
  if (!names) return 'none'
  if (names === '份量') return 'portion'
  if (names === '辣度') return 'spicy'
  if (names === '温度') return 'temp'
  if (names === '辣度,加料') return 'noodle'
  return 'none'
}

Page({
  data: {
    id: '',
    isNew: true,
    name: '',
    price: '',
    desc: '',
    catIndex: 0,
    catName: '',
    catNames: [],
    cats: [],
    emoji: '🍖',
    bg: PALETTES[0],
    emojis: [],
    tags: [],
    tagList: buildTagList([]),
    specKey: 'none',
    specOptions: [
      { key: 'none', label: '无规格' },
      { key: 'portion', label: '份量（大份加价）' },
      { key: 'spicy', label: '辣度' },
      { key: 'temp', label: '冰 / 常温' },
      { key: 'noodle', label: '辣度 + 加料' }
    ],
    isOn: true,
    sales: 0,
    saving: false
  },

  onLoad(query) {
    const emojis = EMOJIS.map(function (e, i) {
      return { e: e, bg: PALETTES[i % PALETTES.length] }
    })
    const cats = store.getCategories()
    const catNames = cats.map(function (c) {
      return c.name
    })

    if (query.id) {
      const dish = store.getRawDishById(query.id)
      if (!dish) {
        wx.showToast({ title: '菜品不存在', icon: 'none' })
        setTimeout(function () {
          wx.navigateBack()
        }, 600)
        return
      }
      const catIndex = Math.max(
        0,
        cats.findIndex(function (c) {
          return c.id === dish.cat
        })
      )
      this.setData({
        id: dish.id,
        isNew: false,
        name: dish.name,
        price: String(dish.price),
        desc: dish.desc || '',
        catIndex: catIndex,
        catName: catNames[catIndex] || '',
        catNames: catNames,
        cats: cats,
        emoji: dish.emoji,
        bg: dish.bg,
        emojis: emojis,
        tags: dish.tags || [],
        tagList: buildTagList(dish.tags),
        specKey: detectSpecKey(dish.specs),
        isOn: dish.status !== 'off',
        sales: dish.sales || 0
      })
    } else {
      this.setData({
        isNew: true,
        catIndex: 0,
        catName: catNames[0] || '',
        catNames: catNames,
        cats: cats,
        emojis: emojis,
        emoji: emojis[0].e,
        bg: emojis[0].bg
      })
    }
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onPrice(e) {
    this.setData({ price: e.detail.value })
  },

  onDesc(e) {
    this.setData({ desc: e.detail.value })
  },

  onCatChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      catIndex: idx,
      catName: this.data.catNames[idx] || ''
    })
  },

  onPickEmoji(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.emojis[idx]
    this.setData({ emoji: item.e, bg: item.bg })
  },

  onTag(e) {
    const label = e.currentTarget.dataset.label
    const tagList = this.data.tagList.map(function (t) {
      return t.label === label ? { label: t.label, on: !t.on } : t
    })
    const tags = tagList
      .filter(function (t) {
        return t.on
      })
      .map(function (t) {
        return t.label
      })
    this.setData({ tagList: tagList, tags: tags })
  },

  onSpec(e) {
    this.setData({ specKey: e.currentTarget.dataset.key })
  },

  onStatus(e) {
    this.setData({ isOn: e.detail.value })
  },

  onSave() {
    if (this.data.saving) return
    const name = (this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写菜品名称', icon: 'none' })
      return
    }
    const price = Number(this.data.price)
    if (!(price > 0)) {
      wx.showToast({ title: '请填写正确的价格', icon: 'none' })
      return
    }
    const cats = this.data.cats
    if (!cats.length) {
      wx.showToast({ title: '请先在后台配置分类', icon: 'none' })
      return
    }
    const specTpl = store.SPEC_TEMPLATES[this.data.specKey] || store.SPEC_TEMPLATES.none
    const dish = {
      id: this.data.id || 'd' + Date.now(),
      cat: cats[this.data.catIndex].id,
      name: name,
      desc: (this.data.desc || '').trim() || '现点现做 · 好味即刻上桌',
      price: Math.round(price * 100) / 100,
      emoji: this.data.emoji,
      bg: this.data.bg,
      tags: this.data.tags,
      sales: this.data.sales,
      status: this.data.isOn ? 'on' : 'off',
      specs: JSON.parse(JSON.stringify(specTpl.specs))
    }
    this.setData({ saving: true })
    store.upsertDish(dish)
    wx.showToast({ title: this.data.isNew ? '已新增菜品' : '已保存修改', icon: 'none' })
    setTimeout(function () {
      wx.navigateBack()
    }, 500)
  },

  onDelete() {
    const that = this
    wx.showModal({
      title: '删除菜品',
      content: '删除后顾客将看不到这道菜，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#E5484D',
      success: function (res) {
        if (!res.confirm) return
        store.removeDish(that.data.id)
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(function () {
          wx.navigateBack()
        }, 400)
      }
    })
  },

  onCancel() {
    wx.navigateBack()
  }
})
