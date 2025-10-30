# Project Context

## Purpose
Weila Work Unity (微喇企业版) is an enterprise management platform for Chinese organizations. It provides comprehensive tools for user management, location tracking, internal communication, and business services coordination for distributed teams.

## Tech Stack
- **Frontend**: Vue 3, TypeScript, Vite, Arco Design Vue
- **State Management**: Pinia, @tanstack/vue-query
- **Routing**: Vue Router with file-based routing
- **Styling**: UnoCSS
- **Internationalization**: Vue I18n (Chinese/English)
- **Build Tool**: Vite
- **Package Manager**: pnpm with workspace support
- **Testing**: Vitest
- **Code Quality**: ESLint (@antfu/eslint-config)

## Project Conventions

### Code Style
- TypeScript strict mode enabled
- ESLint with Antfu's configuration
- Auto-imports for Vue composables and utilities
- File-based component organization
- Composition API preferred over Options API

### Architecture Patterns
- **Monorepo structure** with pnpm workspaces
- **File-based routing** using unplugin-vue-router
- **API layer** with custom hooks for data fetching
- **Store-based authentication** with token refresh
- **Component-driven development** with reusable UI components
- **Internationalization-first** approach with Chinese as primary language

### Testing Strategy
- Unit tests with Vitest
- Component testing with Vue Test Utils
- API integration testing
- Focus on critical business logic and user flows

### Git Workflow
- Feature branches from `main`
- Conventional commit messages
- PR reviews before merging
- Semantic versioning for releases

## Domain Context
- **Chinese enterprise software** (微喇 = Weila)
- **Location-based services** using Gaode Maps (Chinese mapping service)
- **SMS-based authentication** for Chinese mobile numbers
- **Enterprise-grade user management** with hierarchical permissions
- **Multi-tenant architecture** for different organizations

## Important Constraints
- Must support Chinese language and business practices
- Location services limited to Gaode Maps API
- SMS verification requires Chinese mobile numbers
- Enterprise security and data privacy requirements
- Performance requirements for real-time location tracking

## External Dependencies
- **Gaode Maps API** for location services and mapping
- **SMS Gateway** for authentication verification
- **Payment Processing** (PayPal integration)
- **Video.js** for media playback
- **@turf/turf** for geospatial operations
