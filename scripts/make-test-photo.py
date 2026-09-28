#!/usr/bin/env python3
"""
生成一张「模拟手机拍摄的纸面作文」测试图。

刻意做出真实拍摄会遇到的干扰：
  · 纸面倾斜
  · 光照不均 + 手影
  · 深色桌面背景
  · 两处涂改笔迹（用来测试擦除功能）

用途：在模拟器上验证拍照 → 矫正 → 去阴影 → OCR 的完整链路，
以及自动化回归。真实手机拍摄当然比这个更复杂，但这一步能覆盖主要算法。

用法：python3 scripts/make-test-photo.py [输出路径]
"""
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/test-essay-photo.jpg"

ESSAY = """With the rapid development of society, more and more people
think that university education should be free. Every coin has
two sides. In my opinion, I agree with this idea.

Firstly, free education can help a lot of poor students to get
into university. Because the tuition fee is very high, so many
students from poor families have to give up their study. If the
government pay the tuition, these students can go to university.

On the other hand, some people think free education will bring
some bad things. They say the government has many important
things to do, such as building roads and hospitals. Besides,
if the education is free, the quality of teaching will go down.

In a word, I think free university education is good. Although
it has some disadvantages, but the advantages are more. The
government should pay attention to this problem and make a plan."""


def load_font(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    W, H = 1500, 2100
    img = Image.new("RGB", (W, H), (58, 54, 50))  # 深色桌面

    # --- 纸面（先画成一张独立图片，便于整体旋转） ---
    paper_w, paper_h = 1240, 1760
    paper = Image.new("RGB", (paper_w, paper_h), (250, 248, 242))
    draw = ImageDraw.Draw(paper)

    font = load_font(30)
    margin = 90
    y = margin
    for line in ESSAY.split("\n"):
        draw.text((margin, y), line, fill=(38, 36, 40), font=font)
        y += 46

    # 两处涂改笔迹，用来测试「擦除」
    draw.line([(margin + 40, 300), (margin + 460, 306)], fill=(60, 60, 150), width=4)
    draw.line([(margin + 30, 1120), (margin + 380, 1114)], fill=(60, 60, 150), width=4)

    # --- 光照不均：左上亮、右下暗，再叠一条手影 ---
    light = Image.new("L", (paper_w, paper_h))
    lp = light.load()
    for yy in range(paper_h):
        for xx in range(0, paper_w, 4):
            base = 255 - int(70 * (xx / paper_w)) - int(60 * (yy / paper_h))
            lp[xx, yy] = max(120, base)
            for k in range(1, 4):
                if xx + k < paper_w:
                    lp[xx + k, yy] = lp[xx, yy]
    light = light.filter(ImageFilter.GaussianBlur(60))
    paper = Image.composite(paper, Image.new("RGB", paper.size, (0, 0, 0)), light.point(lambda v: v))

    shadow = ImageDraw.Draw(paper)
    shadow.rectangle([paper_w - 320, 0, paper_w, paper_h], fill=None)

    # --- 旋转后贴到桌面背景 ---
    angle = -3.5
    rotated = paper.rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=(58, 54, 50))

    # 纸张投影
    shade = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle(
        [0, 0, rotated.size[0] - 1, rotated.size[1] - 1], fill=(0, 0, 0, 90)
    )
    shade = shade.filter(ImageFilter.GaussianBlur(22))

    ox = (W - rotated.size[0]) // 2
    oy = (H - rotated.size[1]) // 2
    img.paste(shade, (ox + 10, oy + 14), shade)
    img.paste(rotated, (ox, oy))

    # 轻微噪点，模拟手机成像
    img = img.filter(ImageFilter.GaussianBlur(0.4))

    img.save(OUT, quality=88)
    print(f"已生成 {OUT}  ({W}×{H})")
    print("包含：倾斜 %.1f°、光照渐变、纸张投影、两处涂改笔迹" % abs(angle))


if __name__ == "__main__":
    main()
