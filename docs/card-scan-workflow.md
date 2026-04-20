# Card Scan Workflow

Use this workflow for every physical tarot card scan before replacing assets in `public/cards`.

## Scan settings

- Scan in color.
- Use `600 ppp` as the master source.
- Keep the raw scan file in `C:\Users\Nicolas\Pictures`.
- Do not resize the raw scan before extraction.

## Extraction rule

- Extract cards from the raw scan with a `minAreaRect`-based perspective correction.
- Do not reuse already resized or normalized PNGs as a source.
- Save intermediate extracted cards in `C:\Users\Nicolas\Pictures\scan_tarot*_minrect_preview`.
- Save validated per-card PNGs in `C:\Users\Nicolas\Pictures\scan_tarot_cards`.

## Validation checklist

- Check that the card is upright.
- Check that borders are straight, without trapezoid distortion.
- Check that the full white frame is preserved.
- Remove the dark scan background from rounded corners so outer pixels become transparent.
- If a card is slightly tilted in the scan, correct it during extraction instead of stretching it later.

## Project replacement

- Copy only validated PNGs into the matching `public/cards` suit directory.
- Run the transparent-corner cleanup on scanned PNGs before copying them into the project.
- Run `npm run cards:optimize` after copying scanned cards into `public/cards`.
- Keep master extracted PNGs in `C:\Users\Nicolas\Pictures\scan_tarot_cards`; `public/cards` is the optimized runtime copy.
- Keep the scene display ratio aligned with scanned cards.
- If the game still shows the previous image, force-refresh the browser or fully restart the iPhone PWA.

## Notes

- `scan_tarot2` and later scans should use the `minAreaRect` pipeline by default.
- Prefer fixing orientation at extraction time, not in the scene renderer.
