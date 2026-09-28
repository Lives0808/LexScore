#!/usr/bin/env python3
"""
在 Android 截图里定位品牌色按钮/卡片的精确纵向位置。

用途：用 adb 做界面自动化测试时，凭肉眼估算坐标很容易点偏。
这里直接解码 PNG（手写，不依赖 PIL），按行统计目标颜色的像素数，
给出候选点击中心点。

用法：python3 scripts/find-ui-target.py <png> <hex颜色> [最小像素数]
"""
import sys
import zlib
import struct


def decode_png(path):
    with open(path, "rb") as f:
        data = f.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "不是 PNG"

    pos = 8
    width = height = None
    idat = bytearray()
    bit_depth = color_type = None

    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length

        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break

    assert bit_depth == 8, f"只支持 8 位深，实际 {bit_depth}"
    channels = {0: 1, 2: 3, 4: 2, 6: 4}[color_type]
    raw = zlib.decompress(bytes(idat))

    stride = width * channels
    out = bytearray(stride * height)
    prev = bytearray(stride)

    p = 0
    for y in range(height):
        ftype = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride

        if ftype == 1:  # Sub
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 0xFF

        out[y * stride : (y + 1) * stride] = line
        prev = line

    return width, height, channels, out


def main():
    path = sys.argv[1]
    hexcolor = sys.argv[2].lstrip("#")
    min_px = int(sys.argv[3]) if len(sys.argv) > 3 else 200

    tr = int(hexcolor[0:2], 16)
    tg = int(hexcolor[2:4], 16)
    tb = int(hexcolor[4:6], 16)

    width, height, channels, px = decode_png(path)
    stride = width * channels

    rows = []
    for y in range(height):
        base = y * stride
        count = 0
        for x in range(0, width, 2):  # 隔点采样，够用且快
            i = base + x * channels
            if (
                abs(px[i] - tr) <= 12
                and abs(px[i + 1] - tg) <= 12
                and abs(px[i + 2] - tb) <= 12
            ):
                count += 1
        rows.append(count * 2)

    # 把连续命中行合并成区块
    blocks = []
    start = None
    for y, c in enumerate(rows):
        if c >= min_px and start is None:
            start = y
        elif c < min_px and start is not None:
            blocks.append((start, y - 1))
            start = None
    if start is not None:
        blocks.append((start, height - 1))

    print(f"图像 {width}x{height}，目标色 #{hexcolor}，阈值 {min_px} 像素/行")
    if not blocks:
        print("没有命中区块")
        return
    for top, bottom in blocks:
        center = (top + bottom) // 2
        print(f"  区块 y={top}..{bottom}  高 {bottom - top + 1}px  → 点击中心 y={center}")


if __name__ == "__main__":
    main()
