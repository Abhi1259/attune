#!/usr/bin/env node
/**
 * Generates build/icon.png (1024), build/icon.ico (256, PNG-embedded),
 * build/icon.icns (ic08+ic10 PNG entries) and build/tray.png (32) —
 * zero dependencies, pure zlib.
 *
 * Design: warm off-white rounded square, three equalizer bars (near-black),
 * one accent tick — mirrors the app's minimal palette.
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'build')
fs.mkdirSync(buildDir, { recursive: true })

// ---------------- palette ----------------
const BG = [250, 249, 247] // #faf9f7
const INK = [26, 25, 23] // #1a1917
const ACCENT = [76, 156, 139] // #4c9c8b

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
    crc32.table = table
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  // filter 0 per row
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Renders the mark at any resolution: 0..1 coords, rounded-corner square + bars. */
function renderMark(size, { transparentBg = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const radius = size * 0.225
  const pad = size * 0.16
  const barW = size * 0.085
  const gap = size * 0.075
  // bar heights (relative), aligned to a shared baseline
  const baseline = size - pad
  const heights = [0.18, 0.34, 0.52]
  const totalW = barW * 3 + gap * 2
  const startX = (size - totalW) / 2

  const inRoundedRect = (x, y, x0, y0, w, h, r) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false
    const cx = Math.max(x0 + r, Math.min(x, x0 + w - r))
    const cy = Math.max(y0 + r, Math.min(y, y0 + h - r))
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (!transparentBg && !inRoundedRect(x, y, 0, 0, size, size, radius)) {
        // outside: fully transparent
        continue
      }
      let color = transparentBg ? [0, 0, 0, 0] : [...BG, 255]
      // bars
      bars: for (let b = 0; b < 3; b++) {
        const x0 = startX + b * (barW + gap)
        const h = heights[b] * size
        if (x >= x0 && x < x0 + barW && y >= baseline - h && y <= baseline) {
          color = [...INK, 255]
          break bars
        }
      }
      // accent tick floating over the tallest bar's top-right
      const tick = { x0: startX + 2 * (barW + gap), y0: baseline - heights[2] * size - size * 0.03 - size * 0.05, w: barW, h: size * 0.05 }
      if (x >= tick.x0 && x < tick.x0 + tick.w && y >= tick.y0 && y < tick.y0 + tick.h) {
        color = [...ACCENT, 255]
      }
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = color[3]
    }
  }
  return px
}

/** Box-average downscale for the 256px entries. */
function downscale(px, from, to) {
  const out = Buffer.alloc(to * to * 4)
  const ratio = from / to
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      const x0 = Math.floor(x * ratio), x1 = Math.min(from, Math.ceil((x + 1) * ratio))
      const y0 = Math.floor(y * ratio), y1 = Math.min(from, Math.ceil((y + 1) * ratio))
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * from + xx) * 4
          r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3]; n++
        }
      }
      const o = (y * to + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
    }
  }
  return out
}

// ---------------- outputs ----------------
const icon1024 = renderMark(1024)
fs.writeFileSync(path.join(buildDir, 'icon.png'), encodePng(1024, 1024, icon1024))

// ICO with one 256px PNG entry (Vista+ format).
const icon256 = downscale(icon1024, 1024, 256)
const png256 = encodePng(256, 256, icon256)
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0) // reserved
icoHeader.writeUInt16LE(1, 2) // icon
icoHeader.writeUInt16LE(1, 4) // count
const entry = Buffer.alloc(16)
entry[0] = 0 // width (256 => 0)
entry[1] = 0 // height (256 => 0)
entry[2] = 0 // palette
entry[3] = 0
entry.writeUInt16LE(1, 4) // planes
entry.writeUInt16LE(32, 6) // bpp
entry.writeUInt32LE(png256.length, 8)
entry.writeUInt32LE(22, 12) // data offset (6 + 16)
fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([icoHeader, entry, png256]))

// ICNS with ic08 (256) + ic10 (1024-ish, we ship 512 for size) PNG chunks.
const icon512 = downscale(icon1024, 1024, 512)
const png512 = encodePng(512, 512, icon512)
const chunkIc08 = Buffer.concat([Buffer.from('ic08', 'ascii'), Buffer.alloc(4), png256])
chunkIc08.writeUInt32BE(png256.length + 8, 4)
const chunkIc10 = Buffer.concat([Buffer.from('ic10', 'ascii'), Buffer.alloc(4), png512])
chunkIc10.writeUInt32BE(png512.length + 8, 4)
const body = Buffer.concat([chunkIc08, chunkIc10])
const icns = Buffer.alloc(8 + body.length)
icns.write('icns', 0, 'ascii')
icns.writeUInt32BE(icns.length, 4)
body.copy(icns, 8)
fs.writeFileSync(path.join(buildDir, 'icon.icns'), icns)

// Tray: small transparent-square variant, dark bars (light tray themes: still visible).
const tray32 = renderMark(32, { transparentBg: true })
fs.writeFileSync(path.join(buildDir, 'tray.png'), encodePng(32, 32, tray32))

console.log('[icons] wrote build/icon.png, build/icon.ico, build/icon.icns, build/tray.png')
