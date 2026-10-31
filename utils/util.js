/**
 * 通用工具方法
 */

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/** 金额展示：整数不带小数，非整数保留两位 */
function fmtMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

/** 10-31 12:30 */
function formatTime(ts) {
  const d = new Date(ts)
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/** 2026-10-31 12:30:08 */
function formatFull(ts) {
  const d = new Date(ts)
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  )
}

function isSameDay(a, b) {
  const x = new Date(a)
  const y = new Date(b)
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  )
}

/** 刚刚 / 23 分钟前 / 今天 12:30 / 昨天 18:20 / 10-29 09:10 */
function relativeTime(ts) {
  const now = Date.now()
  const diff = now - ts
  if (diff >= 0 && diff < 60 * 1000) return '刚刚'
  if (diff >= 0 && diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前'
  if (isSameDay(ts, now)) return '今天 ' + formatTime(ts).slice(6)
  const yesterday = now - 24 * 60 * 60 * 1000
  if (isSameDay(ts, yesterday)) return '昨天 ' + formatTime(ts).slice(6)
  return formatTime(ts)
}

/** 订单号：SW + 年月日 + 4 位序号 */
function genOrderNo(ts) {
  const d = new Date(ts)
  const rand = Math.floor(Math.random() * 9000) + 1000
  return 'SW' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + rand
}

/** 取餐码：4 位数字 */
function pickupCode(ts) {
  return String(1000 + (Math.floor(ts / 1000) % 9000))
}

/** 兼容新旧基础库的窗口信息 */
function windowInfo() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return wx.getWindowInfo()
    }
  } catch (e) {
    // 降级到旧接口
  }
  try {
    return wx.getSystemInfoSync()
  } catch (e) {
    return { windowWidth: 375, windowHeight: 667, safeArea: null }
  }
}

/** 简易节流：同一次事件循环内只执行一次 */
function throttle(fn, wait) {
  let last = 0
  return function () {
    const now = Date.now()
    if (now - last < wait) return
    last = now
    return fn.apply(this, arguments)
  }
}

module.exports = {
  pad,
  fmtMoney,
  formatTime,
  formatFull,
  isSameDay,
  relativeTime,
  genOrderNo,
  pickupCode,
  windowInfo,
  throttle
}
