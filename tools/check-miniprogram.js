/**
 * 小程序静态自检工具
 * 在不启动微信开发者工具的情况下，检查工程中最容易出错的几类问题：
 *   1. JSON 语法
 *   2. JS 语法（vm 编译，不执行）
 *   3. app.json 页面声明与文件是否一一对应
 *   4. tabBar 图标是否存在
 *   5. WXML 标签闭合、{{ }} 配对、mustache 中的非法方法调用
 *   6. WXML 事件绑定在对应 Page 中是否有实现
 *   7. 页面跳转 url 是否指向已注册页面
 *   8. WXSS 花括号配对
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const errors = []
const warnings = []

function rel(p) {
  return path.relative(process.cwd(), p).replace(/\\/g, '/')
}

function walk(dir, ext, out) {
  out = out || []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (name === 'node_modules') continue
      walk(full, ext, out)
    } else if (full.endsWith(ext)) {
      out.push(full)
    }
  }
  return out
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push(`${rel(file)}: JSON 解析失败 -> ${e.message}`)
    return null
  }
}

/* ---------------- 1. 工程结构 ---------------- */
const appJsonPath = path.join(ROOT, 'app.json')
const app = readJson(appJsonPath)
if (!app) {
  console.log('app.json 无法解析，终止检查')
  process.exit(1)
}

const pages = app.pages || []
if (!pages.length) errors.push('app.json: pages 为空')

pages.forEach((p) => {
  ;['js', 'json', 'wxml'].forEach((ext) => {
    const file = path.join(ROOT, p + '.' + ext)
    if (!fs.existsSync(file)) errors.push(`缺少页面文件：${p}.${ext}`)
  })
  const wxss = path.join(ROOT, p + '.wxss')
  if (!fs.existsSync(wxss)) warnings.push(`页面没有样式文件：${p}.wxss`)
})

// tabBar 图标
if (app.tabBar && app.tabBar.list) {
  app.tabBar.list.forEach((item) => {
    ;[item.iconPath, item.selectedIconPath].forEach((icon) => {
      if (!icon) return
      const file = path.join(ROOT, icon)
      if (!fs.existsSync(file)) errors.push(`tabBar 图标不存在：${icon}`)
      else if (fs.statSync(file).size > 40 * 1024) warnings.push(`tabBar 图标过大(>40KB)：${icon}`)
    })
    if (!pages.includes(item.pagePath)) {
      errors.push(`tabBar 页面未在 pages 中注册：${item.pagePath}`)
    }
  })
}

// sitemap
if (app.sitemapLocation && !fs.existsSync(path.join(ROOT, app.sitemapLocation))) {
  errors.push(`sitemap 文件不存在：${app.sitemapLocation}`)
}

/* ---------------- 2. JSON / JS 语法 ---------------- */
walk(ROOT, '.json').forEach((file) => {
  readJson(file)
})

walk(ROOT, '.js').forEach((file) => {
  const code = fs.readFileSync(file, 'utf8')
  try {
    new vm.Script(code, { filename: file })
  } catch (e) {
    errors.push(`${rel(file)}: JS 语法错误 -> ${e.message}`)
  }
})

/* ---------------- 3. WXML 检查 ---------------- */
const MUSTACHE = /\{\{[\s\S]*?\}\}/g

function maskMustache(src) {
  return src.replace(MUSTACHE, (m) => ' '.repeat(m.length))
}

function checkWxml(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const name = rel(file)

  // 3.1 mustache 配对
  const opens = (raw.match(/\{\{/g) || []).length
  const closes = (raw.match(/\}\}/g) || []).length
  if (opens !== closes) {
    errors.push(`${name}: {{ }} 数量不匹配（{{ x${opens} / }} x${closes}）`)
  }

  // 3.2 mustache 中不允许方法调用（WXML 表达式不支持函数调用）
  const callRe = /\{\{[^}]*?[\w\]]\s*\.\s*[A-Za-z_$][\w$]*\s*\(/g
  let m
  while ((m = callRe.exec(raw))) {
    errors.push(`${name}: WXML 表达式中不能调用方法 -> ${m[0].trim()}`)
  }

  // 3.3 标签闭合
  const masked = maskMustache(raw)
  const tagRe = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  const stack = []
  let t
  while ((t = tagRe.exec(masked))) {
    if (t[0].startsWith('<!--')) continue
    const tag = t[1]
    const isClose = t[0].startsWith('</')
    const selfClose = t[3] === '/'
    if (isClose) {
      const last = stack.pop()
      if (last !== tag) {
        errors.push(`${name}: 标签闭合错误，期望 </${last || '?'}>，实际 </${tag}>`)
        stack.push(last)
      }
    } else if (!selfClose) {
      stack.push(tag)
    }
  }
  if (stack.length) {
    errors.push(`${name}: 存在未闭合标签 <${stack.join('>, <')}>`)
  }

  // 3.4 wx:for 建议带 wx:key
  const forTags = masked.match(/<[^>]*wx:for=[^>]*>/g) || []
  forTags.forEach((tag) => {
    if (!/wx:for-index|wx:key/.test(tag)) {
      warnings.push(`${name}: wx:for 缺少 wx:key -> ${tag.slice(0, 60)}`)
    }
  })

  // 3.5 事件处理函数必须在 js 中实现
  const jsFile = file.replace(/\.wxml$/, '.js')
  const js = fs.existsSync(jsFile) ? fs.readFileSync(jsFile, 'utf8') : ''
  const handlerRe = /(?:bind|catch|capture-bind|capture-catch)[:]?([a-z]+)?="([A-Za-z_$][\w$]*)"/g
  const seen = new Set()
  let h
  while ((h = handlerRe.exec(raw))) {
    const fn = h[2]
    if (seen.has(fn)) continue
    seen.add(fn)
    const defined =
      new RegExp(`\\b${fn}\\s*\\(`).test(js) || new RegExp(`\\b${fn}\\s*:`).test(js)
    if (!defined) errors.push(`${name}: 事件 ${h[0]} 在 ${path.basename(jsFile)} 中没有实现`)
  }
}

walk(ROOT, '.wxml').forEach(checkWxml)

/* ---------------- 4. 页面跳转目标 ---------------- */
const navRe = /(?:navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{[^}]*?url\s*:\s*'([^']+)'/g

function checkNav(file) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = navRe.exec(src))) {
    let url = m[1].split('?')[0]
    if (url.startsWith('/')) url = url.slice(1)
    if (url.includes('$')) continue
    if (!pages.includes(url)) {
      errors.push(`${rel(file)}: 跳转目标未注册 -> ${m[1]}`)
    }
  }
}

walk(ROOT, '.js').forEach((file) => {
  if (file.endsWith('app.js')) return
  checkNav(file)
})

/* ---------------- 5. WXSS ---------------- */
walk(ROOT, '.wxss').forEach((file) => {
  const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const open = (src.match(/\{/g) || []).length
  const close = (src.match(/\}/g) || []).length
  if (open !== close) errors.push(`${rel(file)}: 花括号不配对（{ x${open} / } x${close}）`)
  if (/\bgap\s*:/.test(src)) warnings.push(`${rel(file)}: 使用了 gap，旧版基础库可能不支持`)
})

/* ---------------- 输出 ---------------- */
const uniqueErrors = [...new Set(errors)]
const uniqueWarnings = [...new Set(warnings)]

if (uniqueWarnings.length) {
  console.log(`\n⚠️  警告 ${uniqueWarnings.length} 条：`)
  uniqueWarnings.forEach((w) => console.log('   - ' + w))
}

if (uniqueErrors.length) {
  console.log(`\n❌ 错误 ${uniqueErrors.length} 条：`)
  uniqueErrors.forEach((e) => console.log('   - ' + e))
  process.exit(1)
}

console.log(`\n✅ 检查通过：${pages.length} 个页面，${walk(ROOT, '.js').length} 个 JS，${walk(ROOT, '.wxml').length} 个 WXML，${walk(ROOT, '.wxss').length} 个 WXSS`)
