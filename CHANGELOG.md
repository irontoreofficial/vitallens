# Changelog

## [1.0.5] — 2026-07-10

### 🛡️ Badge Fixes
- Replaced deprecated Shields.io marketplace badges with working Badgen.net badge links in both README and marketplace metadata, resolving the `retired badge` warning.

## [1.0.3] — 2026-07-10

### 🌐 Multi-Language SEO Linter & Predictor
- Expanded SEO linter rules to support Angular, React, Vue, Next.js, HTML, CSS, and JavaScript.
- Added above-line CodeLens warnings, suggestions, and instant Quick Fixes.
- Redesigned the sidebar webview panel with predicted Core Web Vitals (LCP, CLS, INP) status cards.
- Created custom SVG Activity Bar icon with dynamic theme support.
- Fixed relative screenshots display in Marketplace by adding the repository link in `package.json`.

## [1.0.2] — 2026-06-16

### 🔍 SEO & Marketplace Optimization
- Fully rewrote README with comparison table, FAQ, full package rules table, and keyword-rich content
- Added marketplace badges (version, downloads, rating)
- Expanded `keywords` array to 20 high-traffic terms
- Optimized short description for marketplace search algorithm
- Added `galleryBanner` dark theme configuration



All notable changes to VitalLens are documented here.

## [1.0.0] — 2026-06-16

### 🎉 Initial Release

#### Features
- **Bundle Weight Sensor**: Detects 30+ heavy npm packages in `package.json` with inline CodeLens showing bundle size and TTI impact
- **Image Optimization Warnings**: Flags raw `<img>` tags and oversized images (>200KB)
- **Redirect Loop Detector**: Detects circular, self, and chained redirects in `next.config.js`
- **Live Score Panel**: Activity Bar sidebar with animated 0-100 score gauge and per-category breakdowns
- **Quick Fix support**: One-click fixes for img → Image, package replacements
- **Auto-analyze on save**: Panel updates every time you save a file
- **Theme-aware UI**: Sidebar adapts to Dark, Light, and High Contrast VS Code themes
