# Extension Icons

This directory contains the icons for the Chrome extension.

## Required Icons

The extension requires three icon sizes:
- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Generating Icons

You can use the provided `icon.svg` as a base and convert it to PNG using:

### Using ImageMagick (if installed)
```bash
convert -background none -resize 16x16 icons/icon.svg icons/icon16.png
convert -background none -resize 48x48 icons/icon.svg icons/icon48.png
convert -background none -resize 128x128 icons/icon.svg icons/icon128.png
```

### Using Online Tools
1. Open `icon.svg` in a browser
2. Take a screenshot or use an online SVG to PNG converter
3. Resize to the required dimensions
4. Save as `icon16.png`, `icon48.png`, and `icon128.png`

### Using Design Tools
- Figma, Sketch, Adobe Illustrator, or Inkscape can export SVG to PNG at specific sizes

## Placeholder Icons

For development purposes, simple colored squares can be used as placeholders.
