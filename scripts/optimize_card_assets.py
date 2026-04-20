from __future__ import annotations

from pathlib import Path

from PIL import Image


PROJECT_CARDS_DIR = Path(r"C:\Users\Nicolas\Desktop\Projets\ProjetCNAM\public\cards")
MAX_CARD_HEIGHT = 1200


def optimize_image(path: Path) -> tuple[int, int, int, int, int, int] | None:
    original_size = path.stat().st_size
    image = Image.open(path)
    original_mode = image.mode
    original_width, original_height = image.size

    if original_height <= MAX_CARD_HEIGHT:
        return None

    ratio = MAX_CARD_HEIGHT / original_height
    target_width = max(1, round(original_width * ratio))
    target_height = MAX_CARD_HEIGHT

    if "A" in original_mode:
        working_image = image.convert("RGBA")
    else:
        working_image = image.convert("RGB")

    resized = working_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    resized.save(path, optimize=True)

    optimized_size = path.stat().st_size
    return original_width, original_height, target_width, target_height, original_size, optimized_size


def main() -> None:
    optimized = []

    for path in sorted(PROJECT_CARDS_DIR.rglob("*.png")):
        result = optimize_image(path)
        if result is not None:
            optimized.append((path, result))

    original_total = 0
    optimized_total = 0

    for path, (old_width, old_height, new_width, new_height, old_size, new_size) in optimized:
        original_total += old_width * old_height * 4
        optimized_total += new_width * new_height * 4
        print(
            f"{path.relative_to(PROJECT_CARDS_DIR)}: "
            f"{old_width}x{old_height} -> {new_width}x{new_height}, "
            f"{old_size / 1024 / 1024:.2f}MB -> {new_size / 1024 / 1024:.2f}MB"
        )

    print(f"optimized_files={len(optimized)}")
    print(f"estimated_gpu_before={original_total / 1024 / 1024:.1f}MB")
    print(f"estimated_gpu_after={optimized_total / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
