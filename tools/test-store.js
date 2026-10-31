/**
 * 业务逻辑自测：用内存版 wx.storage 跑一遍数据层，验证购物车合并、下单金额、
 * 订单状态流转、商家统计等核心逻辑，不依赖微信开发者工具。
 */
const path = require('path')
const assert = require('assert')

const memory = new Map()
global.wx = {
  getStorageSync(key) {
    return memory.has(key) ? memory.get(key) : ''
  },
  setStorageSync(key, value) {
    memory.set(key, JSON.parse(JSON.stringify(value)))
  },
  removeStorageSync(key) {
    memory.delete(key)
  }
}

const store = require(path.join(__dirname, '..', 'utils', 'store.js'))

let passed = 0
function it(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    console.log('  ✗ ' + name + '\n    ' + e.message)
    process.exitCode = 1
  }
}

console.log('数据层自测：')

it('初始化后写入 16 道菜、6 个分类、2 条历史订单', () => {
  store.init()
  assert.strictEqual(store.getDishes().length, 16)
  assert.strictEqual(store.getCategories().length, 6)
  assert.strictEqual(store.getOrders().length, 2)
})

it('初始化是幂等的，重复调用不会重复写入', () => {
  const before = store.getOrders().length
  store.init()
  assert.strictEqual(store.getOrders().length, before)
})

it('加入购物车：同菜品同规格合并，不同规格分开', () => {
  store.clearCart()
  const dish = store.getDishById('d01')
  store.addToCart(dish, '小份', 42, 1)
  store.addToCart(dish, '小份', 42, 2)
  store.addToCart(dish, '大份', 52, 1)
  const cart = store.getCart()
  assert.strictEqual(cart.length, 2)
  assert.strictEqual(cart[0].qty, 3)
  assert.strictEqual(cart[1].unitPrice, 52)
  const sum = store.summarize(cart)
  assert.strictEqual(sum.count, 4)
  assert.strictEqual(sum.amount, 3 * 42 + 52)
})

it('数量减到 0 时自动从购物车移除', () => {
  store.clearCart()
  const dish = store.getDishById('d12')
  store.addToCart(dish, '', 3, 2)
  const key = store.getCart()[0].key
  store.changeQty(key, -1)
  assert.strictEqual(store.getCart()[0].qty, 1)
  store.changeQty(key, -1)
  assert.strictEqual(store.getCart().length, 0)
})

it('下单：金额 = 菜品 + 打包费 - 满减，且生成取餐码与时间轴', () => {
  store.clearCart()
  const cart = [
    { key: 'd01|小份', dishId: 'd01', name: '招牌红烧肉', emoji: '🍖', bg: store.BG.warm, unitPrice: 42, qty: 2, specText: '小份' },
    { key: 'd12|', dishId: 'd12', name: '五常米饭', emoji: '🍚', bg: store.BG.sand, unitPrice: 3, qty: 2, specText: '' }
  ]
  const order = store.createOrder({
    mode: 'takeaway',
    tableNo: '',
    people: 2,
    remark: '不要香菜',
    items: cart,
    packingFee: 2,
    discount: 5
  })
  assert.strictEqual(order.subtotal, 90)
  assert.strictEqual(order.total, 87)
  assert.strictEqual(order.status, 'pending')
  assert.ok(/^\d{4}$/.test(order.pickupCode))
  assert.strictEqual(order.timeline.length, 1)
  assert.strictEqual(order.items.length, 2)
})

it('订单状态流转：接单 → 出餐 → 完成，时间轴逐步追加', () => {
  const order = store.getOrders()[0]
  store.updateOrderStatus(order.id, 'accepted')
  store.updateOrderStatus(order.id, 'ready')
  store.updateOrderStatus(order.id, 'completed')
  const updated = store.getOrder(order.id)
  assert.strictEqual(updated.status, 'completed')
  assert.deepStrictEqual(
    updated.timeline.map((t) => t.status),
    ['pending', 'accepted', 'ready', 'completed']
  )
})

it('订单进度节点：当前状态之前的节点均标记完成', () => {
  const order = store.getOrders()[0]
  const steps = store.buildSteps(order)
  assert.strictEqual(steps.length, 4)
  assert.ok(steps.every((s) => s.done))
  assert.strictEqual(steps[3].active, true)
})

it('取消订单：状态与文案正确，节点不再推进', () => {
  const order = store.getOrders()[0]
  store.updateOrderStatus(order.id, 'canceled')
  const meta = store.statusMeta('canceled')
  assert.strictEqual(meta.label, '已取消')
  assert.ok(store.buildSteps(store.getOrder(order.id)).every((s) => !s.done))
})

it('再来一单：历史订单商品可以整单回填购物车', () => {
  store.clearCart()
  const order = store.getOrders().find((o) => o.status === 'completed')
  store.addOrderItemsBack(order)
  const sum = store.summarize()
  const expect = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  assert.strictEqual(sum.amount, expect)
})

it('商家统计：营业额只统计今天的未取消订单', () => {
  const stats = store.adminStats()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayOrders = store
    .getOrders()
    .filter((o) => o.status !== 'canceled' && o.createdAt >= startOfDay.getTime())
  const revenue = todayOrders.reduce((s, o) => s + o.total, 0)
  assert.strictEqual(stats.revenue, revenue)
  // 用同一口径算出的单量做对比，避免跨零点时写死的期望值失效
  assert.strictEqual(stats.todayCount, todayOrders.length)
  assert.ok(stats.onSale > 0)
})

it('菜品上下架与新增', () => {
  store.setDishStatus('d02', 'off')
  assert.strictEqual(
    store.getDishById('d02').status,
    'off'
  )
  const list = store.getDishes().filter((d) => d.status === 'on')
  assert.strictEqual(list.length, 15)

  store.upsertDish({
    id: 'd99',
    cat: 'drink',
    name: '测试新品',
    desc: '',
    price: 9,
    emoji: '🥤',
    bg: store.BG.mint,
    tags: [],
    sales: 0,
    status: 'on',
    specs: []
  })
  assert.strictEqual(store.getDishes().length, 17)
  store.removeDish('d99')
  assert.strictEqual(store.getDishes().length, 16)
  store.setDishStatus('d02', 'on')
})

it('店铺设置可局部更新，且不影响其它字段', () => {
  const before = store.getSettings()
  store.saveSettings({ isOpen: false })
  const now = store.getSettings()
  assert.strictEqual(now.isOpen, false)
  assert.strictEqual(now.name, before.name)
  store.saveSettings({ isOpen: true })
})

it('重置数据后恢复到初始状态', () => {
  store.resetAll()
  assert.strictEqual(store.getDishById('d02').status, 'on')
  assert.strictEqual(store.getOrders().length, 2)
  assert.strictEqual(store.getCart().length, 0)
})

console.log('\n通过 ' + passed + ' 项')
