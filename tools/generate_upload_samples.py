"""Generate the project's original upload fixtures using only the Python standard library.

The generated PNGs are committed; running this script is not needed to start the app.
"""
import math
import struct
import zlib
from pathlib import Path


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def generate_samples():
    folder = Path(__file__).resolve().parents[1] / "backend/src/main/resources/static/demo"
    width, height = 480, 360
    for number in [1, 2]:
        rows = bytearray()
        for y in range(height):
            rows.append(0)
            for x in range(width):
                sky = (155 + y // 8, 203 + y // 18, 213 - y // 10) if number == 1 else (207 - y // 10, 180 + y // 12, 205)
                sun = (x - (350 if number == 1 else 130)) ** 2 + (y - 105) ** 2 < 42 ** 2
                if sun:
                    color = (255, 228, 164)
                elif y > 235 + 25 * math.sin(x / 75 + number):
                    color = (100 + y // 8, 151 + number * 10, 133 + number * 15)
                elif y > 180 + abs(x - 240) / 2:
                    color = (92, 132, 131)
                else:
                    color = sky
                rows.extend(max(0, min(255, int(c))) for c in color)
        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
        (folder / f"sample-{number}.png").write_bytes(png)


if __name__ == "__main__":
    generate_samples()
