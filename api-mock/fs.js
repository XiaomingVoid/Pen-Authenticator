/**
 * fs 模块浏览器 mock：用内存 Map 模拟应用 data 目录。
 * 机制见 api-mock/langningchen.js 头注释。
 */

const _files = new Map() // path -> string 内容
const _dirs = new Set(['.'])

function normalize(p) {
  const path = String(p || '.').replace(/\\/g, '/')
  const parts = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..') parts.pop()
    else if (part === '..' && !path.startsWith('/')) parts.push(part)
    else if (part !== '..') parts.push(part)
  }
  return (path.startsWith('/') ? '/' : '') + parts.join('/') || '.'
}

function parentDir(p) {
  const i = normalize(p).lastIndexOf('/')
  return i < 0 ? '.' : i === 0 ? '/' : normalize(p).slice(0, i)
}

function makeDirectories(path) {
  const pending = []
  let p = path
  while (!_dirs.has(p)) {
    if (_files.has(p)) return false
    pending.push(p)
    const parent = parentDir(p)
    if (parent === p) break
    p = parent
  }
  for (const dir of pending.reverse()) _dirs.add(dir)
  return true
}

export default {
  async readdir(path, options) {
    const p = normalize(path)
    if (!_dirs.has(p)) throw new Error(`[mock] fs.readdir: directory does not exist ${p}`)
    const names = [..._files.keys(), ..._dirs]
      .filter((f) => parentDir(f) === p && f !== p)
      .map((f) => f.slice(f.lastIndexOf('/') + 1))
    const uniq = [...new Set(names)]
    if (options && options.withFileTypes) {
      return uniq.map((name) => ({
        name,
        isFile: () => _files.has(normalize(`${p}/${name}`)),
        isDirectory: () => _dirs.has(normalize(`${p}/${name}`))
      }))
    }
    return uniq
  },

  async stat(path) {
    const p = normalize(path)
    if (!_files.has(p) && !_dirs.has(p)) throw new Error(`[mock] fs.stat: path does not exist ${p}`)
    const content = _files.get(p)
    const now = Date.now()
    return {
      size: content !== undefined ? new TextEncoder().encode(content).length : 0,
      atimeMs: now,
      mtimeMs: now,
      birthtimeMs: now
    }
  },

  async exists(path) {
    const p = normalize(path)
    return _files.has(p) || _dirs.has(p)
  },

  async readFile(path) {
    const p = normalize(path)
    if (!_files.has(p)) {
      throw new Error(`[mock] fs.readFile: 文件不存在 ${p}`)
    }
    return _files.get(p)
  },

  async mkdir(path) {
    const p = normalize(path)
    return makeDirectories(p)
  },

  async rm(path) {
    const p = normalize(path)
    const isDescendant = (entry) => p === '.'
      ? entry !== '.' && !entry.startsWith('/') && entry !== '..' && !entry.startsWith('../')
      : entry.startsWith(p === '/' ? '/' : p + '/')
    _files.delete(p)
    _dirs.delete(p)
    for (const f of [..._files.keys()]) {
      if (isDescendant(f)) _files.delete(f)
    }
    for (const dir of [..._dirs]) {
      if (isDescendant(dir)) _dirs.delete(dir)
    }
    return true
  },

  /** mock 专有：写文件（真实 fs 模块无此接口，测试/演示用） */
  async _writeFile(path, content) {
    const p = normalize(path)
    const dir = parentDir(p)
    if (!makeDirectories(dir) || _dirs.has(p)) {
      throw new Error(`[mock] fs._writeFile: invalid file path ${p}`)
    }
    _files.set(p, String(content))
  }
}
