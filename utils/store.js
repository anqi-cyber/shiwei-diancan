/**
 * 数据层：菜单、购物车、订单、店铺设置
 * 全部基于本地缓存（wx.getStorageSync / wx.setStorageSync），
 * 顾客端与商家端读写同一份数据，因此在商家端改菜品 / 改订单状态，
 * 顾客端下拉刷新或重新进入页面即可看到变化。
 */
const util = require('./util')

const KEYS = {
  SEEDED: 'sw_seeded_v1',
  SETTINGS: 'sw_settings_v1',
  CATEGORIES: 'sw_categories_v1',
  DISHES: 'sw_dishes_v1',
  CART: 'sw_cart_v1',
  ORDERS: 'sw_orders_v1'
}

/* ============================ 状态字典 ============================ */

const STATUS = {
  pending: { label: '待接单', desc: '已下单，等待商家接单', tone: 'warn' },
  accepted: { label: '制作中', desc: '商家已接单，正在为你现炒', tone: 'brand' },
  ready: { label: '待取餐', desc: '餐品已备好，请到取餐台领取', tone: 'green' },
  completed: { label: '已完成', desc: '订单已完成，感谢光临', tone: 'muted' },
  canceled: { label: '已取消', desc: '订单已取消', tone: 'muted' }
}

const STATUS_SEQ = [
  { key: 'pending', label: '已下单' },
  { key: 'accepted', label: '商家接单' },
  { key: 'ready', label: '制作完成' },
  { key: 'completed', label: '订单完成' }
]

/** 规格模板：新增 / 编辑菜品时直接套用，保证数据结构统一 */
const SPEC_TEMPLATES = {
  none: { label: '无规格', specs: [] },
  portion: {
    label: '份量',
    specs: [{ name: '份量', required: true, values: [{ label: '小份', delta: 0 }, { label: '大份', delta: 10 }] }]
  },
  spicy: {
    label: '辣度',
    specs: [
      {
        name: '辣度',
        required: true,
        values: [{ label: '微辣', delta: 0 }, { label: '中辣', delta: 0 }, { label: '特辣', delta: 0 }]
      }
    ]
  },
  temp: {
    label: '冰 / 常温',
    specs: [
      {
        name: '温度',
        required: true,
        values: [{ label: '冰', delta: 0 }, { label: '常温', delta: 0 }]
      }
    ]
  },
  noodle: {
    label: '辣度 + 加料',
    specs: [
      {
        name: '辣度',
        required: true,
        values: [{ label: '不辣', delta: 0 }, { label: '微辣', delta: 0 }, { label: '中辣', delta: 0 }]
      },
      {
        name: '加料',
        required: false,
        values: [{ label: '不加', delta: 0 }, { label: '加煎蛋', delta: 3 }, { label: '加牛肉', delta: 8 }]
      }
    ]
  }
}

/* ============================ 初始数据 ============================ */

const DEFAULT_SETTINGS = {
  name: '拾味小馆',
  branch: '望京店',
  rating: 4.9,
  monthSales: 1286,
  notice: '现点现炒 · 高峰出餐约 15 分钟，堂食请留意取餐叫号',
  hours: '10:00 - 21:30',
  isOpen: true,
  phone: '010-88886666',
  tables: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'B01', 'B02', 'B03', 'B04'],
  packingFee: 2,
  discountThreshold: 50,
  discountAmount: 5,
  adminPin: '8888'
}

const DEFAULT_CATEGORIES = [
  { id: 'signature', name: '招牌推荐', sort: 1 },
  { id: 'hot', name: '小炒热菜', sort: 2 },
  { id: 'soup', name: '汤羹', sort: 3 },
  { id: 'staple', name: '主食', sort: 4 },
  { id: 'cold', name: '凉菜小吃', sort: 5 },
  { id: 'drink', name: '饮品', sort: 6 }
]

const BG = {
  warm: ['#FFE3D3', '#FFC6A8'],
  red: ['#FFE0E0', '#FFC2C2'],
  amber: ['#FFEDD5', '#FFD9A8'],
  cream: ['#FFF6DC', '#FFE7AE'],
  green: ['#E8F5E1', '#CBE8BC'],
  mint: ['#E7F5E4', '#C7E9C0'],
  purple: ['#F0E4F5', '#DCC5E8'],
  lemon: ['#FBF6D8', '#F2E7A8'],
  sand: ['#F5F1EA', '#E9E1D4']
}

const DEFAULT_DISHES = [
  {
    id: 'd01',
    cat: 'signature',
    name: '招牌红烧肉',
    desc: '三层五花 · 冰糖慢炖两小时',
    price: 42,
    emoji: '🍖',
    bg: BG.warm,
    tags: ['招牌'],
    sales: 326,
    status: 'on',
    specs: SPEC_TEMPLATES.portion.specs
  },
  {
    id: 'd02',
    cat: 'signature',
    name: '剁椒鱼头',
    desc: '千岛湖花鲢 · 剁椒鲜辣',
    price: 68,
    emoji: '🐟',
    bg: BG.red,
    tags: ['招牌', '中辣'],
    sales: 214,
    status: 'on',
    specs: [
      {
        name: '份量',
        required: true,
        values: [{ label: '半份', delta: 0 }, { label: '整份', delta: 28 }]
      }
    ]
  },
  {
    id: 'd03',
    cat: 'signature',
    name: '小炒黄牛肉',
    desc: '黄牛肉配螺丝椒 · 猛火快炒',
    price: 48,
    emoji: '🥩',
    bg: BG.amber,
    tags: ['热销', '中辣'],
    sales: 412,
    status: 'on',
    specs: SPEC_TEMPLATES.spicy.specs
  },
  {
    id: 'd04',
    cat: 'hot',
    name: '麻婆豆腐',
    desc: '嫩豆腐 · 汉源花椒',
    price: 22,
    emoji: '🍲',
    bg: BG.warm,
    tags: ['微辣'],
    sales: 289,
    status: 'on',
    specs: SPEC_TEMPLATES.spicy.specs
  },
  {
    id: 'd05',
    cat: 'hot',
    name: '干锅花菜',
    desc: '有机花菜 · 腊肉提香',
    price: 28,
    emoji: '🥦',
    bg: BG.green,
    tags: [],
    sales: 176,
    status: 'on',
    specs: SPEC_TEMPLATES.spicy.specs
  },
  {
    id: 'd06',
    cat: 'hot',
    name: '番茄炒蛋',
    desc: '沙瓤番茄 · 土鸡蛋',
    price: 18,
    emoji: '🍅',
    bg: BG.red,
    tags: ['素食'],
    sales: 198,
    status: 'on',
    specs: []
  },
  {
    id: 'd07',
    cat: 'hot',
    name: '酸辣土豆丝',
    desc: '手工切丝 · 爽脆开胃',
    price: 16,
    emoji: '🥔',
    bg: BG.cream,
    tags: ['微辣', '素食'],
    sales: 232,
    status: 'on',
    specs: []
  },
  {
    id: 'd08',
    cat: 'soup',
    name: '紫菜蛋花汤',
    desc: '例汤 · 暖胃清口',
    price: 12,
    emoji: '🥣',
    bg: BG.green,
    tags: [],
    sales: 143,
    status: 'on',
    specs: []
  },
  {
    id: 'd09',
    cat: 'soup',
    name: '玉米排骨汤',
    desc: '甜玉米 · 肋排炖足三小时',
    price: 26,
    emoji: '🌽',
    bg: BG.cream,
    tags: ['招牌'],
    sales: 97,
    status: 'on',
    specs: []
  },
  {
    id: 'd10',
    cat: 'staple',
    name: '扬州炒饭',
    desc: '虾仁叉烧 · 粒粒分明',
    price: 22,
    emoji: '🍚',
    bg: BG.cream,
    tags: ['热销'],
    sales: 265,
    status: 'on',
    specs: []
  },
  {
    id: 'd11',
    cat: 'staple',
    name: '手工担担面',
    desc: '碱水面 · 芝麻酱打底',
    price: 20,
    emoji: '🍜',
    bg: BG.warm,
    tags: ['中辣'],
    sales: 187,
    status: 'on',
    specs: SPEC_TEMPLATES.noodle.specs
  },
  {
    id: 'd12',
    cat: 'staple',
    name: '五常米饭',
    desc: '东北五常 · 现焖小锅饭',
    price: 3,
    emoji: '🍚',
    bg: BG.sand,
    tags: [],
    sales: 890,
    status: 'on',
    specs: []
  },
  {
    id: 'd13',
    cat: 'cold',
    name: '口水鸡',
    desc: '散养土鸡 · 红油麻辣',
    price: 32,
    emoji: '🍗',
    bg: BG.warm,
    tags: ['招牌', '中辣'],
    sales: 156,
    status: 'on',
    specs: SPEC_TEMPLATES.spicy.specs
  },
  {
    id: 'd14',
    cat: 'cold',
    name: '蒜香拍黄瓜',
    desc: '现拍黄瓜 · 清爽解腻',
    price: 12,
    emoji: '🥒',
    bg: BG.mint,
    tags: ['素食'],
    sales: 204,
    status: 'on',
    specs: []
  },
  {
    id: 'd15',
    cat: 'drink',
    name: '冰镇酸梅汤',
    desc: '古法熬制 · 解辣必备',
    price: 8,
    emoji: '🥤',
    bg: BG.purple,
    tags: ['热销'],
    sales: 421,
    status: 'on',
    specs: SPEC_TEMPLATES.temp.specs
  },
  {
    id: 'd16',
    cat: 'drink',
    name: '手打柠檬茶',
    desc: '香水柠檬 · 鸭屎香茶底',
    price: 12,
    emoji: '🍋',
    bg: BG.lemon,
    tags: [],
    sales: 178,
    status: 'on',
    specs: SPEC_TEMPLATES.temp.specs
  }
]

/* ============================ 基础读写 ============================ */

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    if (v === '' || v === null || v === undefined) return fallback
    return v
  } catch (e) {
    return fallback
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value)
    return true
  } catch (e) {
    console.error('[store] 写入缓存失败', key, e)
    return false
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/* ============================ 初始化 ============================ */

function seedOrders() {
  const now = Date.now()
  const todayOrderTs = now - 100 * 60 * 1000
  const oldOrderTs = now - 3 * 24 * 60 * 60 * 1000
  return [
    {
      id: 'seed-today',
      no: 'SW' + util.genOrderNo(todayOrderTs).slice(2, 10) + '0001',
      status: 'completed',
      createdAt: todayOrderTs,
      mode: 'dinein',
      tableNo: 'A02',
      people: 2,
      remark: '不要香菜',
      items: [
        { key: 'd01|小份', dishId: 'd01', name: '招牌红烧肉', emoji: '🍖', bg: BG.warm, unitPrice: 42, qty: 1, specText: '小份' },
        { key: 'd12|', dishId: 'd12', name: '五常米饭', emoji: '🍚', bg: BG.sand, unitPrice: 3, qty: 2, specText: '' }
      ],
      subtotal: 48,
      packingFee: 0,
      discount: 0,
      total: 48,
      pickupCode: '1024',
      paid: true,
      timeline: [
        { status: 'pending', at: todayOrderTs, label: '已下单' },
        { status: 'accepted', at: todayOrderTs + 2 * 60 * 1000, label: '商家接单' },
        { status: 'ready', at: todayOrderTs + 16 * 60 * 1000, label: '制作完成' },
        { status: 'completed', at: todayOrderTs + 40 * 60 * 1000, label: '订单完成' }
      ]
    },
    {
      id: 'seed-old',
      no: 'SW' + util.genOrderNo(oldOrderTs).slice(2, 10) + '0002',
      status: 'completed',
      createdAt: oldOrderTs,
      mode: 'takeaway',
      tableNo: '',
      people: 1,
      remark: '',
      items: [
        { key: 'd11|不辣·加煎蛋', dishId: 'd11', name: '手工担担面', emoji: '🍜', bg: BG.warm, unitPrice: 23, qty: 1, specText: '不辣 · 加煎蛋' },
        { key: 'd15|冰', dishId: 'd15', name: '冰镇酸梅汤', emoji: '🥤', bg: BG.purple, unitPrice: 8, qty: 1, specText: '冰' }
      ],
      subtotal: 31,
      packingFee: 2,
      discount: 0,
      total: 33,
      pickupCode: '2048',
      paid: true,
      timeline: [
        { status: 'pending', at: oldOrderTs, label: '已下单' },
        { status: 'accepted', at: oldOrderTs + 60 * 1000, label: '商家接单' },
        { status: 'ready', at: oldOrderTs + 12 * 60 * 1000, label: '制作完成' },
        { status: 'completed', at: oldOrderTs + 30 * 60 * 1000, label: '订单完成' }
      ]
    }
  ]
}

function init() {
  if (read(KEYS.SEEDED, false)) return
  write(KEYS.SETTINGS, DEFAULT_SETTINGS)
  write(KEYS.CATEGORIES, DEFAULT_CATEGORIES)
  write(KEYS.DISHES, DEFAULT_DISHES)
  write(KEYS.CART, [])
  write(KEYS.ORDERS, seedOrders())
  write(KEYS.SEEDED, true)
}

function resetAll() {
  Object.keys(KEYS).forEach(function (k) {
    try {
      wx.removeStorageSync(KEYS[k])
    } catch (e) {
      // ignore
    }
  })
  init()
}

/* ============================ 店铺设置 ============================ */

function getSettings() {
  const saved = read(KEYS.SETTINGS, {})
  return Object.assign({}, DEFAULT_SETTINGS, saved)
}

function saveSettings(patch) {
  const next = Object.assign({}, getSettings(), patch)
  write(KEYS.SETTINGS, next)
  return next
}

/* ============================ 菜品 / 分类 ============================ */

function getCategories() {
  return read(KEYS.CATEGORIES, DEFAULT_CATEGORIES)
}

function decorateDish(d) {
  const tags = (d.tags || []).map(function (t) {
    let type = 'spicy'
    if (t === '招牌' || t === '热销') type = 'hot'
    else if (t === '素食') type = 'green'
    return { text: t, type: type }
  })
  return Object.assign({}, d, {
    tags: tags,
    specs: d.specs || [],
    priceText: util.fmtMoney(d.price),
    specHint: d.specs && d.specs.length ? '选规格' : ''
  })
}

function getDishes() {
  const list = read(KEYS.DISHES, DEFAULT_DISHES)
  return list.map(decorateDish)
}

function getRawDishes() {
  return read(KEYS.DISHES, DEFAULT_DISHES)
}

function getDishById(id) {
  const raw = getRawDishes().filter(function (d) {
    return d.id === id
  })[0]
  return raw ? decorateDish(raw) : null
}

function getRawDishById(id) {
  return (
    getRawDishes().filter(function (d) {
      return d.id === id
    })[0] || null
  )
}

function saveDishes(list) {
  write(KEYS.DISHES, list)
}

function upsertDish(dish) {
  const list = getRawDishes()
  const idx = list.findIndex(function (d) {
    return d.id === dish.id
  })
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], dish)
  else list.unshift(dish)
  saveDishes(list)
  return dish
}

function removeDish(id) {
  saveDishes(
    getRawDishes().filter(function (d) {
      return d.id !== id
    })
  )
}

function setDishStatus(id, status) {
  const list = getRawDishes()
  const d = list.filter(function (x) {
    return x.id === id
  })[0]
  if (d) d.status = status
  saveDishes(list)
}

function categoryName(id) {
  const c = getCategories().filter(function (x) {
    return x.id === id
  })[0]
  return c ? c.name : '未分类'
}

/* ============================ 购物车 ============================ */

function getCart() {
  return read(KEYS.CART, [])
}

function saveCart(cart) {
  write(KEYS.CART, cart)
}

function summarize(cart) {
  const list = cart || getCart()
  let count = 0
  let amount = 0
  list.forEach(function (i) {
    count += i.qty
    amount += i.unitPrice * i.qty
  })
  return { count: count, amount: amount }
}

/**
 * 加入购物车（同菜品同规格自动合并）
 * @param {object} dish 菜品
 * @param {string} specText 规格文案，如 "小份 · 中辣"
 * @param {number} unitPrice 含规格加价的单价
 * @param {number} qty 数量
 */
function addToCart(dish, specText, unitPrice, qty) {
  const cart = getCart()
  const key = dish.id + '|' + (specText || '')
  const found = cart.filter(function (i) {
    return i.key === key
  })[0]
  if (found) {
    found.qty += qty
  } else {
    cart.push({
      key: key,
      dishId: dish.id,
      name: dish.name,
      emoji: dish.emoji,
      bg: dish.bg,
      unitPrice: unitPrice,
      qty: qty,
      specText: specText || ''
    })
  }
  saveCart(cart)
  return summarize(cart)
}

function changeQty(key, delta) {
  const cart = getCart()
  const item = cart.filter(function (i) {
    return i.key === key
  })[0]
  if (!item) return summarize(cart)
  item.qty += delta
  const next = cart.filter(function (i) {
    return i.qty > 0
  })
  saveCart(next)
  return summarize(next)
}

function clearCart() {
  saveCart([])
  return summarize([])
}

/** 再来一单：把历史订单商品重新放回购物车 */
function addOrderItemsBack(order) {
  let cart = getCart()
  ;(order.items || []).forEach(function (it) {
    const key = it.dishId + '|' + (it.specText || '')
    const found = cart.filter(function (i) {
      return i.key === key
    })[0]
    if (found) found.qty += it.qty
    else
      cart.push({
        key: key,
        dishId: it.dishId,
        name: it.name,
        emoji: it.emoji,
        bg: it.bg,
        unitPrice: it.unitPrice,
        qty: it.qty,
        specText: it.specText || ''
      })
  })
  saveCart(cart)
  return summarize(cart)
}

/* ============================ 订单 ============================ */

function getOrders() {
  return read(KEYS.ORDERS, [])
}

function saveOrders(list) {
  write(KEYS.ORDERS, list)
}

function createOrder(payload) {
  const now = Date.now()
  const settings = getSettings()
  const items = payload.items || []
  const subtotal = items.reduce(function (s, i) {
    return s + i.unitPrice * i.qty
  }, 0)
  const order = {
    id: 'o' + now,
    no: util.genOrderNo(now),
    status: 'pending',
    createdAt: now,
    mode: payload.mode,
    tableNo: payload.tableNo || '',
    people: payload.people || 1,
    remark: payload.remark || '',
    items: items,
    subtotal: subtotal,
    packingFee: payload.packingFee || 0,
    discount: payload.discount || 0,
    total: subtotal + (payload.packingFee || 0) - (payload.discount || 0),
    pickupCode: util.pickupCode(now),
    paid: true,
    shopName: settings.name,
    timeline: [{ status: 'pending', at: now, label: '已下单' }]
  }
  const list = getOrders()
  list.unshift(order)
  saveOrders(list)
  return order
}

function getOrder(id) {
  return (
    getOrders().filter(function (o) {
      return o.id === id
    })[0] || null
  )
}

function updateOrderStatus(id, status) {
  const list = getOrders()
  const order = list.filter(function (o) {
    return o.id === id
  })[0]
  if (!order) return null
  order.status = status
  order.timeline = order.timeline || []
  order.timeline.push({
    status: status,
    at: Date.now(),
    label: (STATUS[status] || {}).label || status
  })
  saveOrders(list)
  return order
}

/* ============================ 统计 ============================ */

function adminStats() {
  const orders = getOrders()
  const today = orders.filter(function (o) {
    return util.isSameDay(o.createdAt, Date.now())
  })
  const valid = today.filter(function (o) {
    return o.status !== 'canceled'
  })
  const revenue = valid.reduce(function (s, o) {
    return s + o.total
  }, 0)
  const pending = orders.filter(function (o) {
    return o.status === 'pending'
  }).length
  const making = orders.filter(function (o) {
    return o.status === 'accepted' || o.status === 'ready'
  }).length
  const onSale = getRawDishes().filter(function (d) {
    return d.status === 'on'
  }).length
  return {
    revenue: revenue,
    revenueText: util.fmtMoney(revenue),
    todayCount: valid.length,
    pending: pending,
    making: making,
    onSale: onSale
  }
}

function userStats() {
  const orders = getOrders()
  const done = orders.filter(function (o) {
    return o.status === 'completed'
  })
  const spent = done.reduce(function (s, o) {
    return s + o.total
  }, 0)
  return {
    orderCount: orders.length,
    doneCount: done.length,
    spentText: util.fmtMoney(spent)
  }
}

/** 订单状态展示信息 */
function statusMeta(status) {
  const meta = STATUS[status] || STATUS.pending
  return { label: meta.label, desc: meta.desc, tone: meta.tone, key: status }
}

/** 根据订单生成进度节点（含时间） */
function buildSteps(order) {
  const canceled = order.status === 'canceled'
  const timeline = order.timeline || []
  const currentIdx = canceled
    ? 0
    : STATUS_SEQ.findIndex(function (s) {
        return s.key === order.status
      })
  return STATUS_SEQ.map(function (s, i) {
    const hit = timeline.filter(function (t) {
      return t.status === s.key
    })[0]
    return {
      key: s.key,
      label: s.label,
      time: hit ? util.formatTime(hit.at).slice(6) : '',
      done: !canceled && currentIdx >= i,
      active: !canceled && currentIdx === i,
      canceled: canceled && i === 0
    }
  })
}

module.exports = {
  KEYS: KEYS,
  STATUS: STATUS,
  SPEC_TEMPLATES: SPEC_TEMPLATES,
  BG: BG,
  init: init,
  resetAll: resetAll,
  getSettings: getSettings,
  saveSettings: saveSettings,
  getCategories: getCategories,
  getDishes: getDishes,
  getRawDishes: getRawDishes,
  getDishById: getDishById,
  getRawDishById: getRawDishById,
  saveDishes: saveDishes,
  upsertDish: upsertDish,
  removeDish: removeDish,
  setDishStatus: setDishStatus,
  categoryName: categoryName,
  getCart: getCart,
  saveCart: saveCart,
  summarize: summarize,
  addToCart: addToCart,
  changeQty: changeQty,
  clearCart: clearCart,
  addOrderItemsBack: addOrderItemsBack,
  getOrders: getOrders,
  saveOrders: saveOrders,
  createOrder: createOrder,
  getOrder: getOrder,
  updateOrderStatus: updateOrderStatus,
  adminStats: adminStats,
  userStats: userStats,
  statusMeta: statusMeta,
  buildSteps: buildSteps
}
