// 生成 PWA 所需的 PNG 图标（无需任何 npm 依赖，仅用 Node 内置模块）
// 用法：在项目根目录运行  node scripts/generate-icons.mjs
// 会生成 public/icon-192.png、icon-512.png、icon-maskable-512.png
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---------- 绘制：渐变背景 + 白色火焰 ----------
const TOP = [255, 114, 94] // #ff725e
const BOTTOM = [98, 86, 232] // #6256e8

// 火焰多边形（归一化坐标，y 向下）
const FLAME = [
  [0.5, 0.14], [0.58, 0.24], [0.66, 0.38], [0.7, 0.52], [0.66, 0.66],
  [0.56, 0.76], [0.5, 0.86], [0.44, 0.76], [0.34, 0.66], [0.3, 0.52],
  [0.34, 0.38], [0.42, 0.24],
]

function pointInPolygon(px, py, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t)

function makeIcon(size, flameScale) {
  const rgba = Buffer.alloc(size * size * 4)
  const center = 0.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const t = (x + y) / (2 * (size - 1))
      rgba[i] = lerp(TOP[0], BOTTOM[0], t)
      rgba[i + 1] = lerp(TOP[1], BOTTOM[1], t)
      rgba[i + 2] = lerp(TOP[2], BOTTOM[2], t)
      rgba[i + 3] = 255
      const nx = center + ((x + 0.5) / size - center) / flameScale
      const ny = center + ((y + 0.5) / size - center) / flameScale
      if (pointInPolygon(nx, ny, FLAME)) {
        rgba[i] = 255
        rgba[i + 1] = 255
        rgba[i + 2] = 255
      }
    }
  }
  return encodePng(size, size, rgba)
}

const outDir = path.join(process.cwd(), 'public')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, 1))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, 1))
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makeIcon(512, 1.25))

console.log('✅ 已生成图标：')
console.log('   public/icon-192.png')
console.log('   public/icon-512.png')
console.log('   public/icon-maskable-512.png')
