# Weila Enterprise Management System

## Project Overview

This is a Vue.js-based enterprise management system called "微喇企业管理系统" (Weila Enterprise Management System). It's a monorepo project using pnpm workspaces, designed for enterprise communication and management with features including contact management, messaging, device management, and organizational structure management.

## Technology Stack

### Core Technologies
- **Frontend Framework**: Vue 3 with Composition API
- **Build Tool**: Vite with Rolldown (experimental)
- **Package Manager**: pnpm (v10.18.3)
- **Language**: TypeScript
- **Router**: Vue Router with auto-routing (unplugin-vue-router)
- **State Management**: Pinia

### UI Framework & Styling
- **UI Library**: Arco Design Vue (v2.57.0)
- **CSS Framework**: UnoCSS (v66.1.0-beta.3)
- **Styling**: Less preprocessor
- **Icons**: Iconify with Carbon, Ph, and SVG Spinners sets

### Key Dependencies
- **HTTP Client**: Axios with ofetch
- **Form Validation**: Valibot with Zod
- **Maps**: Vue AMap (Gaode Maps integration)
- **Charts**: Vue ECharts
- **Media**: Video.js for video playback
- **Image Processing**: Cropper.js and browser-image-compression
- **Internationalization**: Vue i18n
- **Query Management**: TanStack Vue Query

## Project Structure

```
weila-work-unity/
├── packages/
│   └── web/                    # Main web application
│       ├── src/
│       │   ├── api/            # API service modules
│       │   ├── components/     # Vue components
│       │   ├── composables/    # Vue composables
│       │   ├── directives/     # Custom Vue directives
│       │   ├── layout/         # Layout components
│       │   ├── locale/         # Internationalization files
│       │   ├── modules/        # App modules (plugins)
│       │   ├── pages/          # Auto-routed pages
│       │   ├── stores/         # Pinia stores
│       │   ├── styles/         # Global styles
│       │   ├── types/          # TypeScript type definitions
│       │   └── utils/          # Utility functions
│       ├── corp-manager/       # Corporate manager sub-app
│       ├── generated/          # Generated files (auto-imports, etc.)
│       └── fixtures/           # Mock data and test fixtures
├── docs/                       # Documentation (user manual)
└── node_modules/               # Dependencies
```

## Build and Development Commands

### Development
```bash
# Start development server
pnpm dev

# Start production development server
pnpm dev:prod

# Start with HTTPS (auto-generated certificates)
pnpm dev  # (includes mkcert plugin)
```

### Build Commands
```bash
# Build for production
pnpm build

# Build for staging
pnpm build:staging

# Build with bundle analyzer report
pnpm report
```

### Code Quality
```bash
# Run ESLint
pnpm lint

# Fix ESLint issues
pnpm lint:fix

# Type checking
pnpm typecheck
```

### Testing
```bash
# Run tests with Vitest
pnpm test
```

### Package Management
```bash
# Update dependencies (major versions)
pnpm up

# Update with taze tool
pnpm up  # (uses taze for intelligent updates)
```

### Release & Deployment
```bash
# Bump version and create release
pnpm release

# Create distribution package
pnpm pack

# Archive build
pnpm archive
```

## Code Style Guidelines

### ESLint Configuration
- Uses Anthony Fu's ESLint config (@antfu/eslint-config)
- Vue-specific rules with i18n plugin
- TanStack Query linting rules
- Custom rules restricting `ref()` usage (use `shallowRef()` or `deepRef()` instead)

### Auto-imports
- Vue 3 APIs (ref, reactive, computed, etc.)
- VueUse utilities
- Pinia store functions
- Vue Router auto-imports
- Custom composables from `src/composables/`

### Component Organization
- Components are auto-imported from `src/components/`
- Arco Design components are automatically resolved
- Radix Vue components are automatically resolved
- Vue AMap components are automatically resolved

### File Naming Conventions
- Vue components: PascalCase (e.g., `UserProfile.vue`)
- Composables: camelCase with 'use' prefix (e.g., `useAuth.ts`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase with descriptive names (e.g., `UserInterface.ts`)

## Testing Strategy

- **Test Runner**: Vitest
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Mock Generation**: apipost-mock-gen for generating mock data from API documentation
- Test files should be placed alongside source files with `.test.ts` or `.spec.ts` extensions

## Deployment Configuration

### Vercel Deployment
- Configured with `vercel.json`
- API proxy rewrites to `demo.weila.hk`
- Supports both `/v1/*` and `/v2/*` API endpoints

### Build Output
- Static files served from `dist/` directory
- Build info generated in `dist/build-info.json`
- Multiple entry points: main app and corp-manager

## Development Environment

### Required Node.js Version
- Node.js >= 14.0.0

### Development Server Configuration
- Proxy configuration for API calls to `demo.weila.hk`
- HTTPS support with auto-generated certificates
- CORS enabled
- 20-second timeout for API requests

### Hot Module Replacement
- Enabled for Vue components
- Router hot updates supported

## Security Considerations

- Content Security Policy headers in HTML
- API proxy configuration for secure communication
- Environment-based configuration support

## Key Features

1. **Enterprise Management**: Corporate structure, departments, member management
2. **Communication**: Messaging system with contact management
3. **Device Management**: Device registration and monitoring
4. **Location Services**: Integration with Gaode Maps (AMap)
5. **Media Support**: Video playback and image processing
6. **Internationalization**: Multi-language support (Chinese primary)
7. **VIP System**: Premium features and subscriptions

## Migration Tasks (from README)

- [ ] Migrate all API calls to use @weila/network package
- [ ] Migrate all modal components to use TheModal component
- [ ] Add empty state handling for web components

## Git Hooks

- Pre-commit linting with lint-staged
- Automatic ESLint fixes on commit
- Simple git hooks configuration