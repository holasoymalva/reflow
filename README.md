# Chrome Request Manager

A Chrome extension for managing, modifying, and debugging HTTP/HTTPS requests.

## Project Structure

```
chrome-request-manager/
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

```bash
npm run build
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

## Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

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
