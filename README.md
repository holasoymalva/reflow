# Reflow

A Chrome extension for managing, modifying, and debugging HTTP/HTTPS requests.

## Repository

**GitHub:** https://github.com/holasoymalva/reflow

For support, bug reports, or feature requests, please open an issue directly on the GitHub repository.

## Project Structure

```
reflow/
├── src/
│   ├── background/       # Service worker and background scripts
│   ├── ui/              # React UI components (popup, options)
│   ├── storage/         # Storage management
│   ├── rules/           # Rule engine and evaluation
│   ├── logger/          # Request/response logging
│   └── types/           # TypeScript type definitions
├── dist/                # Build output (generated)
├── manifest.json        # Chrome extension manifest (V3)
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── jest.config.js       # Jest testing configuration
└── vite.config.ts       # Vite build configuration
```

## Development

### Install Dependencies

```bash
npm install
```

### Build

Development build:
```bash
npm run build
```

Production build (optimized and minified):
```bash
npm run build:prod
```

### Development Mode (Watch)

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Type Check

```bash
npm run type-check
```

### Verify Build

```bash
npm run verify
```

## Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Packaging for Distribution

To create a distributable ZIP package:

```bash
npm run package
```

This will:
1. Create an optimized production build
2. Verify all required files are present
3. Generate a ZIP file in the `packages/` directory

The resulting `reflow-v1.0.0.zip` can be:
- Uploaded to the Chrome Web Store
- Distributed to users for manual installation
- Shared with team members for testing

For detailed build and installation instructions, see:
- `BUILD.md` - Build configuration and instructions
- `INSTALLATION.md` - Installation guide for end users
- `TESTING_CHECKLIST.md` - Comprehensive testing procedures

## Testing

The project uses:
- **Jest** for unit testing
- **fast-check** for property-based testing

Run tests with: `npm test`

## Tech Stack

- TypeScript
- React (for UI)
- Vite (build tool)
- Jest + fast-check (testing)
- Chrome Extension APIs (Manifest V3)
