// 生成 PWA 所需的 PNG 图标（零 npm 依赖，仅用 Node 内置模块）
// 用法：在项目根目录运行  node scripts/generate-icons.mjs
// 设计：柔和米白底 + 两枚交叠的火焰/水滴（珊瑚橙 + 靛紫），象征「双燃」的两个人
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

// ---------- 图形定义 ----------
const CREAM = [247, 246, 242] // #f7f6f2 米白底
const CORAL = [255, 114, 94] // #ff725e 珊瑚橙
const INDIGO = [98, 86, 232] // #6256e8 靛紫

// 单枚火焰轮廓：6 段三次贝塞尔，单位坐标（x∈[-1,1]，y∈[-1,1]，y 向下，底部为尖）
const FLAME_SEGS = [
  [[0, -1], [0.36, -1], [0.64, -0.704], [0.64, -0.333]],
  [[0.64, -0.333], [0.64, 0.037], [0.4, 0.333], [0.2, 0.519]],
  [[0.2, 0.519], [0.12, 0.611], [0.06, 0.741], [0, 1]],
  [[0, 1], [-0.06, 0.741], [-0.12, 0.611], [-0.2, 0.519]],
  [[-0.2, 0.519], [-0.4, 0.333], [-0.64, 0.037], [-0.64, -0.333]],
  [[-0.64, -0.333], [-0.64, -0.704], [-0.36, -1], [0, -1]],
]

function cubic(p0, c1, c2, p3, t) {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
  ]
}

function buildFlamePolygon(steps = 12) {
  const points = []
  for (const seg of FLAME_SEGS) {
    for (let i = 0; i < steps; i++) points.push(cubic(seg[0], seg[1], seg[2], seg[3], i / steps))
  }
  return points
}

const FLAME_POLY = buildFlamePolygon()

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

// 火焰实例：中心 (fx,fy)、缩放 scale
const SCALE = 0.24
const LEFT = { fx: 0.4, fy: 0.5 }
const RIGHT = { fx: 0.6, fy: 0.5 }

function flameAt(nx, ny) {
  // 靛紫火焰画在上层（与 icon.svg 的绘制顺序一致）
  const inRight = pointInPolygon((nx - RIGHT.fx) / SCALE, (ny - RIGHT.fy) / SCALE, FLAME_POLY)
  if (inRight) return 2
  const inLeft = pointInPolygon((nx - LEFT.fx) / SCALE, (ny - LEFT.fy) / SCALE, FLAME_POLY)
  if (inLeft) return 1
  return 0
}

// ---------- 渲染（3x3 超采样抗锯齿） ----------
function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const SS = 3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size
          const ny = (y + (sy + 0.5) / SS) / size
          const which = flameAt(nx, ny)
          if (which === 1) {
            r += CORAL[0]; g += CORAL[1]; b += CORAL[2]
          } else if (which === 2) {
            r += INDIGO[0]; g += INDIGO[1]; b += INDIGO[2]
          } else {
            r += CREAM[0]; g += CREAM[1]; b += CREAM[2]
          }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

const outDir = path.join(process.cwd(), 'public')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon-192.png'), renderIcon(192))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), renderIcon(512))
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), renderIcon(512))

console.log('✅ 已生成图标（米白底 + 双色火焰）：')
console.log('   public/icon-192.png')
console.log('   public/icon-512.png')
console.log('   public/icon-maskable-512.png')
