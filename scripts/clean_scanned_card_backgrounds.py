from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image


BLACK_BG_THRESHOLD = 120


def is_dark(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return False
    return ((r + g + b) / 3) < BLACK_BG_THRESHOLD


def iter_border_points(width: int, height: int) -> Iterable[tuple[int, int]]:
    for x in range(width):
        yield (x, 0)
        yield (x, height - 1)
    for y in range(1, height - 1):
        yield (0, y)
        yield (width - 1, y)


def clean_image(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    visited = set()
    queue: deque[tuple[int, int]] = deque()

    for point in iter_border_points(width, height):
        if point in visited:
            continue
        if is_dark(pixels[point]):
            queue.append(point)
            visited.add(point)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)

        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if (nx, ny) in visited:
                continue
            visited.add((nx, ny))
            if is_dark(pixels[nx, ny]):
                queue.append((nx, ny))

    image.save(path, optimize=True)


def main() -> None:
    project_root = Path(r"C:\Users\Nicolas\Desktop\Projets\ProjetCNAM\public\cards")
    work_dir = Path(r"C:\Users\Nicolas\Pictures\scan_tarot_cards")
    project_dirs = [
        project_root / "Atout",
        project_root / "Clover",
        project_root / "Diamond",
        project_root / "Heart",
        project_root / "Spade",
    ]

    for directory in (*project_dirs, work_dir):
        for path in sorted(directory.glob("card_*_*.png")):
            if path.stat().st_size < 1_000_000:
                continue
            clean_image(path)
            print(f"cleaned {path}")


if __name__ == "__main__":
    main()
