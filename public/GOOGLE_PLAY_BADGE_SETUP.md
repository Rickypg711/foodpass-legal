# Google Play Badge Setup

## Official Badge Download

To use the official Google Play badge:

1. Go to: https://play.google.com/intl/en_us/badges/
2. Click "Download all assets"
3. Extract the ZIP file
4. Find the badge you want (e.g., `en_badge_web_generic.png`)
5. Copy it to your `public` folder as `google-play-badge.png`
6. Update the HTML to use: `<img src="/google-play-badge.png" ...>`

## Current Implementation

Currently using an SVG version that matches the official design:
- Official Google Play colors (red, green, yellow, blue)
- "Get it on Google Play" text
- Proper sizing (250x83px to match App Store badge)

## To Switch to Official PNG

Replace the SVG in `download.html` with:
```html
<img src="/google-play-badge.png" alt="Get it on Google Play" class="badge-img">
```

