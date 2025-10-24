# Calico

A production-ready React Native application built with Expo, featuring modern architecture, type safety, and comprehensive developer tooling.

## 🚀 Quick Start

### Installation

```bash
bun install
```

### Development

```bash
bun start        # Start development server
bun ios          # Run on iOS
bun android      # Run on Android
bun web          # Run on web
```

## 📚 Table of Contents

- [Core Technologies](#-core-technologies)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Development Workflow](#-development-workflow)
- [Configuration Details](#-configuration-details)
- [State Management](#-state-management)
- [Auth & Data Access](#-auth--data-access-stytch--supabase-edge-functions)
- [Data Fetching](#-data-fetching)
- [Form Management](#-form-management)
- [Internationalization](#-internationalization)
- [Testing Strategy](#-testing-strategy)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [Resources](#-resources)
- [Contributing](#-contributing)
- [License](#-license)

## 📌 Project Proposal

### Objectives
- Deliver continuous CHF/COPD monitoring that keeps patients, caregivers, and PCPs aligned through automated vitals streaming, AI-assisted outreach, and timely escalations.
- Provide organization, caregiver, and patient/family dashboards with granular IAM and auditability that satisfy HIPAA and enterprise IT expectations.

### Solution Overview
- BodyTrace CHF and COPD kits stream weight, BP, and SpO2 through Terra; normalized events land in Supabase Realtime for thresholding, trend analysis, and downstream actions.
- A VAPI voice agent (HIPAA mode) runs daily check-ins, issues immediate calls on abnormal readings, and stores PDF summaries for caregiver review.
- Authentication, SSO, and SCIM provisioning run through Stych; caregiver and patient dashboards share a single Expo codebase with NativeWind-powered UI and web support via Expo Router.

### Key Capabilities
- Real-time ingestion of weight, BP, SpO2, and heart-rate telemetry with event-driven alerting and green/yellow/red status calculation.
- AI-assisted clinical outreach that escalates non-response or incoherent responses and personalizes prompts per patient profile.
- Caregiver dashboards for enrollment, device assignment, VAPI scheduling, prompt management, PDF report access, and alert triage.
- Organization onboarding with SCIM-powered provisioning plus patient/family portals for secure data access.

### Monitoring & Triage Workflow
- Supabase functions classify trends and thresholds; abnormal events trigger immediate VAPI calls.
- Escalation flows notify caregivers when patients miss or fail calls, and PDF call summaries are filed for audit trails.

### Security & Compliance
- Supabase HIPAA projects supply encryption, network controls, RLS, and BAA coverage; VAPI enforces HIPAA voice handling.
- Stych provides enterprise SSO/SCIM and org-level IAM guardrails while maintaining auditability.

### Risks & Mitigations
- **Integration complexity**: build an end-to-end POC and contract tests across Terra, Supabase, and VAPI.
- **Compliance scope creep**: lock BAAs early, run shared responsibility checklists, and schedule pre-launch audits.
- **Alert latency**: use idempotent webhooks, back-pressure, SLA monitors, and redundant notification channels.
- **IAM sprawl**: model orgs and roles consistently via Stych with Supabase RLS enforcement.

### KPIs & Success Criteria
- ≥80 % daily check-in completion; ≥90 % contact rate for abnormal events during pilots.
- <5-minute Time-to-Alert for critical thresholds with 99.9 % monitoring uptime.
- Measurable caregiver efficiency gains and improved early intervention opportunities for CHF/COPD.

### Decisions Requested
- [ ] Approve Supabase + Terra + VAPI + Stych + Expo/NativeWind stack for MVP delivery.
- [ ] Authorize BAAs/legal review and fund a 2-week POC validating data flow, monitoring, VAPI escalation, and PDF reporting.

### Reference Material
- Supabase: https://supabase.com/docs
- Terra: https://docs.tryterra.co/
- VAPI: https://docs.vapi.ai/quickstart/introduction
- Expo: https://docs.expo.dev/
- UI inspiration: https://welly.dexignzone.com/ and https://miro.com/app/live-embed/uXjVJ5dbzqE=/?embedMode=view_only_without_ui&moveToViewport=-1550%2C-538%2C4319%2C3545&embedId=370905070662

## 🛠️ Core Technologies

### Platform & Framework

- **Expo SDK 54**: Latest version with enhanced native module support, improved performance, and better development experience
- **React Native 0.81.4**: Cross-platform mobile framework with web support via React Native Web 0.21.0
- **React 19.1.0**: Latest React with improved concurrent features and server components preparation
- **TypeScript 5.9.2**: Full type safety with strict mode enabled, path aliases configured via `@/*` imports

### UI & Styling

- **NativeWind v4**: Tailwind CSS for React Native with full dark mode support, platform-specific utilities, and CSS variables
- **Tailwind CSS 3.4**: Utility-first CSS framework with custom theme extensions for native platforms
- **React Native Reanimated 4.1.1**: High-performance animations with layout animations and gesture integration
- **React Native Gesture Handler 2.28.0**: Native gesture recognition with smooth interactions
- **React Native Worklets 0.5.1**: JavaScript worklets for running code on UI thread

### Navigation & Routing

- **Expo Router 6.0.10**: File-based routing built on React Navigation 7.1.6
- **Typed Routes**: Compile-time route validation with TypeScript integration
- **Navigation Modes**: Stack navigation with modal presentation, large titles (iOS), and platform-specific animations

### State Management (Hybrid Approach)

- **Zustand 4.5.1**: Lightweight client-side state management for UI state, preferences, and local data
- **React Query 5.90.5** (TanStack Query): Server state management with caching, automatic refetching, and optimistic updates
- **Secure Storage**: **Expo SecureStore** for auth/session on mobile (Keychain/Keystore).
  **AsyncStorage** only for non-sensitive preferences — **never** for tokens or PHI.

### Data Layer

- **Supabase 2.38.4**: PostgreSQL database and storage (real-time optional), accessed via **Edge Functions** for protected data
- **Stytch**: Authentication provider (B2B for staff; Consumer for patients)
- **API Client**: Custom fetch-based client with TypeScript generics and error handling (targets Edge Functions)
- **React Query Integration**: Hooks-based API with query invalidation and cache management

### Form Management

- **React Hook Form 7.65.0**: Performant form library with minimal re-renders and validation integration
- **Zod 4.1.12**: TypeScript-first schema validation with type inference
- **Hookform Resolvers 5.2.2**: Zod integration for React Hook Form validation

### Internationalization (i18n)

- **i18next 25.6.0**: Industry-standard i18n framework with namespace support and pluralization
- **React i18next 16.1.0**: React bindings with hooks and HOC support
- **Expo Localization 17.0.7**: Device locale detection and calendar preferences
- **JSON-based Translations**: Simple locale files (EN, ES) with extensibility for additional languages

### Monitoring & Error Tracking (HIPAA Compliant)

- **Sentry 7.4.0**: Error tracking configured for HIPAA compliance

  - PII tracking **DISABLED** (no IP addresses, cookies, or user data)
  - Session replay **DISABLED** (prevents PHI capture)
  - Automatic data scrubbing in `beforeSend` and `beforeBreadcrumb` hooks
  - Console breadcrumbs **DISABLED** (may contain sensitive data)
  - Feedback integration enabled for user-initiated reports only

- **Source Maps**: Automatic source map upload for production debugging

### Code Quality & Linting

- **Biome 2.2.6**: Ultra-fast linter and formatter (120x faster than ESLint + Prettier)
- **Single Tool**: Replaces ESLint, Prettier, and import sorting in one tool
- **VCS Integration**: Git-aware file detection and automatic ignore file support
- **Performance**: Sub-second linting on entire codebase

### Testing

- **Maestro**: End-to-end testing with YAML-based flows
- **Platform Support**: iOS, Android, and React Native testing
- **Interactive Studio**: Visual test development and debugging
- **CI Integration**: Automated E2E testing in GitHub Actions

### Developer Experience

- **Bun**: Fast package manager and runtime for all scripts
- **Expo Dev Client 6.0.13**: Custom development builds with native modules
- **Fast Refresh**: Instant feedback during development
- **TypeScript Path Aliases**: Clean imports with `@/` prefix

### Build & Deployment

- **EAS Build**: Cloud-based builds for iOS and Android with automatic versioning
- **EAS Update**: Over-the-air updates for JavaScript changes without rebuilding
- **EAS CLI 16.23.1+**: Latest command-line tools with enhanced features

### Git Automation

- **Husky 9.1.7**: Git hooks management with commit validation
- **lint-staged 16.2.4**: Run linters on staged files only for faster commits

### Native Features

- **Expo Haptics 15.0.7**: Tactile feedback for user interactions
- **Expo Symbols 1.0.7**: SF Symbols (iOS) and Material Symbols integration
- **Expo System UI 6.0.7**: System UI customization (status bar, navigation bar)
- **Expo Web Browser 15.0.7**: In-app browser with authentication flow support
- **Expo Device 8.0.9**: Device information and platform detection

### Performance Optimization

- **FlashList 2.0.2**: High-performance list rendering (Shopify) replacing FlatList
- **Metro Bundler**: Optimized with Sentry integration and NativeWind compilation
- **Code Splitting**: Automatic route-based splitting via Expo Router
- **Asset Optimization**: Automatic image optimization and compression

### UI Component System

- **RN Primitives Slot 1.2.0**: Polymorphic component primitives
- **Class Variance Authority 0.7.0**: Type-safe component variants
- **Tailwind Merge 2.2.1**: Intelligent class name merging
- **Expo Vector Icons 15.0.2**: 10,000+ icons from multiple icon families
- **RN Icon Mapper 0.0.1**: Dynamic icon mapping system

## 🏗️ Architecture Overview

### Design Philosophy

This application follows a **hybrid state management pattern**, separating client-side UI state from server-side data state. This approach provides optimal performance, clear separation of concerns, and excellent developer experience.

### Layer Separation

**Presentation Layer**

- File-based routing with Expo Router
- Reusable UI components with NativeWind
- Platform-specific optimizations
- Theme system with dark mode support

**State Layer**

- Zustand for local UI state (modals, forms, preferences)
- React Query for server data (API calls, caching, synchronization)
- Clear boundaries between client and server state

**Data Layer**

- **Edge Functions** call Postgres/Storage on behalf of the app
- **No direct client writes/reads** to protected tables
- Type-safe data fetching via React Query hooks
- Automatic error handling and retries

**Business Logic Layer**

- Custom hooks for reusable logic
- Form validation with Zod schemas
- i18n translation management
- Environment configuration

## 📁 Project Structure

### Root Configuration

- `app.json` - Expo configuration with plugins, splash screen, icons, and platform settings
- `eas.json` - EAS Build profiles (development, preview, production) with auto-increment
- `tsconfig.json` - TypeScript configuration with strict mode and path aliases
- `tailwind.config.js` - Tailwind configuration with NativeWind presets and platform-specific colors
- `biome.json` - Biome linter/formatter configuration with VCS integration
- `metro.config.js` - Metro bundler with Sentry and NativeWind integration
- `babel.config.js` - Babel configuration with React Native Worklets plugin

### Application Structure

- `app/` - Expo Router pages and layouts (file-based routing)

  - `_layout.tsx` - Root layout with providers, navigation, and theme
  - `index.tsx` - Home screen with component examples
  - `modal.tsx` - Modal example with settings
  - `+html.tsx` - Web HTML template
  - `+not-found.tsx` - 404 page

### Component Organization

- `components/` - Reusable React components

  - `nativewindui/` - UI component library (Button, Text, Icon, ThemeToggle)
  - `forms/` - Form components with validation examples

### State & Data

- `store/` - Zustand stores for client state
- `api/` - API clients and React Query hooks

  - `client.ts` - Edge Function client and (optional) public Supabase client
  - `hooks/` - React Query hooks for data fetching

### Configuration & Utilities

- `config/` - Application configuration

  - `env.ts` - Environment variables with validation

- `lib/` - Utility functions

  - `i18n.ts` - i18next configuration
  - `cn.ts` - Class name utility
  - `useColorScheme.tsx` - Theme hook

- `theme/` - Theme configuration with color system
- `hooks/` - Custom React hooks

### Internationalization

- `locales/` - Translation JSON files

  - `en.json` - English translations
  - `es.json` - Spanish translations

### Testing

- `.maestro/` - E2E test flows

  - `config.yaml` - Maestro configuration
  - `flows/` - Test scenarios in YAML format

### DevOps

- `.github/workflows/` - CI/CD pipelines
- `.husky/` - Git hooks
- `providers/` - React context providers

### Platform-Specific

- `ios/` - iOS native code and configuration
- `android/` - Android native code and configuration

## 💻 Development Workflow

### Daily Development

1. **Start Development Server**: `bun start` launches Expo dev server with dev client
2. **Platform Testing**: Use `bun ios`, `bun android`, or `bun web` for specific platforms
3. **Hot Reload**: Changes automatically reflect in running app
4. **Type Checking**: Real-time TypeScript validation in IDE

### Code Quality Process

1. **Write Code**: Make changes in TypeScript with strict type checking
2. **Auto-Format**: Biome formats on save (with VS Code extension)
3. **Type Check**: `bun run type-check` validates types before commit
4. **Pre-commit Hooks**: Automatic validation on `git commit`

   - Biome linting and formatting on staged files
   - TypeScript type checking across entire codebase
   - JSON syntax validation
   - Console statement warnings (non-blocking)
   - Debugger statement warnings (non-blocking)

### Development Scripts

- `bun start` - Start Expo development server
- `bun ios` - Run on iOS simulator/device
- `bun android` - Run on Android emulator/device
- `bun web` - Run web version in browser
- `bun run lint` - Run Biome linter (check only)
- `bun run format` - Run Biome with auto-fix
- `bun run type-check` - TypeScript type validation
- `bun run prebuild` - Generate native projects

### Build Scripts

- `bun run build:dev` - Development build with debugging
- `bun run build:preview` - Preview build for internal testing
- `bun run build:prod` - Production build for app stores

## ⚙️ Configuration Details

### Biome Configuration

**Location**: `biome.json`

**Features**:

- VCS Integration: Respects `.gitignore` automatically
- Formatter: 100-character line width, 2-space indentation, single quotes
- Linter: Recommended rules with custom overrides
- File Ignoring: Excludes `node_modules`, `.expo`, native folders, logs
- JavaScript Style: ES5 trailing commas, always semicolons, arrow parentheses

**Custom Rules**:

- Disabled `noForEach` for array operations
- Disabled `noNonNullAssertion` for TypeScript assertions
- Disabled `useImportType` for simpler imports
- Disabled `noExplicitAny` for gradual typing
- Disabled `noUnknownAtRules` for Tailwind CSS
- Disabled `noDangerouslySetInnerHtml` for web compatibility

### TypeScript Configuration

**Location**: `tsconfig.json`

**Features**:

- Extends Expo's base TypeScript configuration
- Strict mode enabled for maximum type safety
- Path aliases: `@/*` maps to root directory
- Includes: All TypeScript files, Expo types, NativeWind types

### Tailwind/NativeWind Configuration

**Location**: `tailwind.config.js`

**Features**:

- Dark mode: Class-based manual toggling
- Content paths: `app/**/*` and `components/**/*`
- NativeWind preset: Platform-specific utilities
- Extended colors: Custom color system with opacity support
- Platform-specific CSS variables: Different variables for iOS/Android
- Hairline width: Platform-native border width

### Metro Bundler Configuration

**Location**: `metro.config.js`

**Features**:

- Sentry integration for source maps
- NativeWind transformation with 16px rem size
- Global CSS input from `global.css`

### Babel Configuration

**Location**: `babel.config.js`

**Features**:

- Expo preset with NativeWind JSX import source
- NativeWind Babel plugin
- React Native Worklets plugin for UI thread code

### Maestro Configuration

**Location**: `.maestro/config.yaml`

**Features**:

- App ID: `com.vesko.calico.calico`
- Retries: 2 attempts per test
- Timeout: 30 seconds per operation
- Device support: iOS simulators and Android emulators

### EAS Configuration

**Location**: `eas.json`

**Build Profiles**:

- **Development**: Development client, internal distribution
- **Preview**: Internal distribution for testing
- **Production**: Auto-increment version, store-ready

**Submit Configuration**:

- Production profile for app store submissions

### Expo Configuration

**Location**: `app.json`

**Key Settings**:

- Multi-platform: iOS, Android, Web
- File-based routing: Expo Router plugin
- Sentry plugin: Automatic error tracking
- Typed routes: TypeScript route generation
- TSConfig paths: Path alias support
- Bundle identifier: `com.vesko.calico.calico`
- Orientation: Portrait mode
- Dark mode: Automatic system detection

## 🗄️ State Management

### Client State (Zustand)

**Purpose**: UI state, user preferences, transient data

**Use Cases**:

- Modal visibility and state
- Theme preferences
- Form draft data
- UI toggles and flags
- Navigation state
- Temporary selections

**Architecture**:

- Store location: `store/` directory
- Type-safe stores with TypeScript interfaces
- Minimal boilerplate
- No providers needed
- Devtools support available

**Best Practices**:

- Keep stores focused and small
- Use selectors for performance
- Avoid storing server data
- Use immer for complex updates

### Server State (React Query)

**Purpose**: API data, remote state, cached responses

**Use Cases**:

- Edge Function calls (DB-backed)
- REST API calls
- Real-time data
- Paginated lists
- Infinite scroll
- Mutations with optimistic updates

**Architecture**:

- Provider: `QueryProvider` wraps app in `_layout.tsx`
- Hooks location: `api/hooks/` directory
- Query client configuration:

  - Stale time: 5 minutes
  - Cache time: 24 hours (gcTime)
  - Retry: 2 attempts
  - Window focus refetch: Disabled

**Query Patterns**:

- CRUD operations with separate hooks
- Automatic cache invalidation
- Optimistic UI updates
- Error handling with retry logic
- Loading and error states

**Best Practices**:

- Use query keys consistently
- Implement optimistic updates for mutations
- Invalidate queries after mutations
- Handle loading and error states
- Use stale-while-revalidate pattern
- **Do not persist** PHI-containing queries to AsyncStorage; keep sensitive data in memory only

## 🔐 Auth & Data Access (Stytch + Supabase Edge Functions)

- **Auth**: Clients authenticate with **Stytch** (B2B for staff, Consumer for patients).
- **Backend**: All protected database access goes through **Supabase Edge Functions**.
- **Tenant safety**:

  - **RLS path (recommended)**: Edge Functions verify the Stytch session, resolve the user’s `org_id`, then open a transaction and run `SET LOCAL app.org_id = '<org-uuid>'` so Postgres **Row-Level Security** scopes every query to that org.
  - **Service-role path**: Use the Supabase service role key (bypasses RLS) and **always** filter queries by `org_id` in code.

- **Web tokens**: Do **not** store JS-readable tokens. Edge Functions set **HttpOnly, Secure, SameSite=strict** cookies so the browser sends them automatically.
- **Mobile tokens**: Persist Stytch session/refresh in **Expo SecureStore** (Keychain/Keystore). **Never** store tokens in AsyncStorage.

## 🔄 Data Fetching

### Supabase Integration

**Client**: The app calls **Supabase Edge Functions** for protected data.
**Why**: We use **Stytch** for auth, so Postgres cannot read tenant claims from a Supabase JWT. Edge Functions verify Stytch, resolve `org_id`, and run **RLS-scoped** queries (or service-role queries that always filter by `org_id`).
**Public access**: If a `supabase-js` client exists in the app, it must be limited to **public** resources only (e.g., public Storage buckets) and **must not** touch protected tables.

#### Connecting to your Supabase project

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and authenticate: `supabase login`.
2. Link this repo to your project: `supabase link --project-ref <YOUR_PROJECT_REF>`.
3. Push the schema in `supabase/migrations/`: `supabase db push`.
4. Enable the new API keys in your Supabase Dashboard: `Settings` → `API` → Enable new API key system.
5. Copy `.env.example` → `.env` and set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (starts with `sb_publishable_...`) from your project settings.
6. Store privileged secrets (secret key, JWT secret) in Edge Functions/EAS secrets—never in the Expo client.

### Custom API Client

**Client**: Generic fetch-based client in `api/client.ts` that targets Edge Function endpoints.

**Features**:

- TypeScript generics for type safety
- Automatic JSON handling
- Error response handling
- Base URL configuration
- HTTP methods: GET, POST, PUT, DELETE

### Auth Tokens & Storage

- **Web**: Edge Functions set **HttpOnly, Secure, SameSite=strict** cookies; JS cannot read them. Avoid client-side token persistence.
- **Mobile (iOS/Android)**: Store Stytch tokens in **Expo SecureStore**. **Never** store tokens in AsyncStorage.
- **React Query**: Don’t persist queries that contain PHI; avoid caching sensitive payloads to AsyncStorage.

### React Query Hooks

**Location**: `api/hooks/`

**Hook Patterns**:

- `useItems()` - Fetch list
- `useItem(id)` - Fetch single item
- `useCreateItem()` - Create mutation
- `useUpdateItem()` - Update mutation
- `useDeleteItem()` - Delete mutation

**Features**:

- Query key management
- Cache invalidation
- Optimistic updates
- Error handling
- Loading states

## 📝 Form Management

### React Hook Form Integration

**Version**: 7.65.0

**Features**:

- Minimal re-renders with isolated field updates
- Built-in validation
- Controller component for React Native inputs
- Form state management (dirty, touched, errors)
- Async validation support
- Field arrays for dynamic forms

**Performance Optimizations**:

- Only re-renders changed fields
- Uncontrolled components where possible
- Validation debouncing
- Isolated field subscriptions

### Zod Schema Validation

**Version**: 4.1.12

**Features**:

- TypeScript-first schema definition
- Type inference from schemas
- Custom error messages
- Complex validation rules
- Nested object validation
- Array validation with refinements

**Integration**:

- `@hookform/resolvers` connects Zod to React Hook Form
- Automatic type safety from schema to form
- Runtime and compile-time validation
- Custom validators and transformers

### Form Example

**Location**: `components/forms/ExampleForm.tsx`

**Demonstrates**:

- Schema definition with Zod
- Form setup with React Hook Form
- Controller usage for native inputs
- Error display
- Submit handling
- Type inference

## 🌍 Internationalization

### i18next Setup

**Configuration**: `lib/i18n.ts`

**Features**:

- Device locale detection via Expo Localization
- Fallback language: English
- Namespace support for organizing translations
- Interpolation for dynamic content
- Pluralization support
- JSON compatibility mode v4

### Translation Files

**Location**: `locales/` directory

**Structure**:

- Flat JSON files per language
- Nested keys for organization
- Common namespace for shared strings
- Screen-specific namespaces

**Current Languages**:

- English (`en.json`)
- Spanish (`es.json`)

### Custom Hook

**Location**: `hooks/useI18n.ts`

**Features**:

- Translation function: `t(key)`
- Language switching: `changeLanguage(lang)`
- Current language: `currentLanguage`
- Available languages list
- Type-safe translation keys (optional)

### Adding New Languages

1. Create locale JSON file in `locales/`
2. Import in `lib/i18n.ts`
3. Add to resources object
4. Update language list in `useI18n.ts`

## 🧪 Testing Strategy

### End-to-End Testing with Maestro

**Tool**: Maestro (mobile-focused E2E testing)

**Architecture**:

- YAML-based test flows
- Platform-agnostic (iOS, Android, React Native)
- Visual assertions
- Tap, scroll, input interactions
- Screenshot capture
- Flow composition

### Test Organization

**Location**: `.maestro/flows/`

**Available Tests**:

- `navigation.yaml` - Basic navigation flow
- `test-sentry.yaml` - Sentry error testing

### Running Tests

- All flows: `maestro test .maestro/flows`
- Single flow: `maestro test .maestro/flows/navigation.yaml`
- Interactive studio: `maestro studio`
- Debug mode: `maestro test --debug <flow>`

### CI Integration

Tests can run in GitHub Actions with proper device setup (not currently configured to preserve build minutes).

## 🚀 CI/CD Pipeline

### Workflow Overview

Seven automated GitHub Actions workflows handle code quality, security, builds, and deployments.

### 1. Continuous Integration (`ci.yml`)

**Trigger**: Every push and pull request

**Jobs**:

- Checkout code
- Setup Bun package manager
- Install dependencies
- Run Biome linter
- Run TypeScript type checking

**Purpose**: Ensure code quality before merging

### 2. EAS Build (`eas-build.yml`)

**Trigger**: Manual workflow dispatch

**Inputs**:

- Build profile: development, preview, or production
- Platform: iOS, Android, or all

**Jobs**:

- Checkout code
- Setup Bun and Expo/EAS CLI
- Install dependencies
- Run EAS build with selected profile and platform

**Purpose**: Create native builds on-demand (saves free tier build credits)

### 3. EAS Update (`eas-update.yml`)

**Trigger**: Manual workflow dispatch

**Inputs**:

- Branch: production, preview, or development
- Update message (optional)

**Jobs**:

- Checkout code
- Setup Bun and Expo/EAS CLI
- Install dependencies
- Publish OTA update to selected branch

**Purpose**: Deploy JavaScript updates without rebuilding (free, unlimited)

### 4. Pull Request Automation (`pr-automation.yml`)

**Trigger**: Pull request events (opened, synchronize, closed)

**Jobs**:

- **Auto-label**: Applies labels based on changed files (uses `.github/labeler.yml`)
- **PR Comment + Checklist**: When a PR is opened, `pr-comment` thanks the author and posts the checklist that reviewers expect
- **Check Bundle Size (optional)**: Installs dependencies with `bun install --frozen-lockfile`, runs `du -sh node_modules`, then comments with the dependency footprint

**Purpose**: Streamline PR review process and provide helpful context. The bundle-size job is informational only but will fail if Bun cannot finish installing dependencies; rerun locally via `bun install --frozen-lockfile && du -sh node_modules` (helps diagnose missing lockfile updates) before retrying the workflow. The workflow sets `permissions: { contents: read, pull-requests: write, issues: write }` so GitHub can post checklist/bundle comments—if you downgrade those permissions, the jobs will fail with `Resource not accessible by integration`.

### 5. Security Scanning (`security.yml`)

**Trigger**: Weekly schedule (Mondays 9 AM UTC), manual dispatch, and pull requests against `main`

**Jobs**:

- **Security Audit (optional)**:

  - Install dependencies with `bun install --frozen-lockfile`
  - Run `bun outdated` (Bun lacks a native `bun audit` command) and capture the output in `outdated.txt`
  - Open a GitHub issue labeled `security,dependencies` if outdated packages are detected

- **CodeQL Analysis**:

  - Scan TypeScript/JavaScript code for security issues
  - Automatic SARIF upload to GitHub Security tab
  - Detect common vulnerability patterns

**Purpose**: Proactive security monitoring and vulnerability detection. When the Security Audit job fails, inspect the “Install dependencies” step for lockfile drift, run `bun install --frozen-lockfile && bun outdated` locally, and either refresh dependencies or document why they must remain pinned before re-running the workflow.

### 6. Release Automation (`release.yml`)

**Trigger**: Git tags matching `v*` (e.g., `v1.0.0`)

**Jobs**:

- **Create Release**:

  - Generate changelog from commit history
  - Create GitHub release with formatted changelog
  - Link to full comparison view
  - Notify team via GitHub Actions

- **Publish EAS Update**:

  - Publish OTA update to production branch
  - Tag update with release version
  - Automatic rollout to users

**Purpose**: Automate release process and production deployments

### 7. Dependency Review (`dependency-review.yml`)

**Trigger**: Pull requests

**Jobs**:

- Scan dependency changes in PR
- Identify security vulnerabilities
- Check for license compliance
- Suggest updates and alternatives
- Block PRs with high-severity issues (configurable)

**Purpose**: Prevent vulnerable dependencies from entering codebase

### CI/CD Configuration

**Required Secrets**:

- `EXPO_TOKEN` - EAS authentication token

**Setup Steps**:

1. Login to EAS: `eas login`
2. Get token: `eas whoami`
3. Add to GitHub: Settings → Secrets → Actions → New repository secret

**Labeler Configuration**:
Located in `.github/labeler.yml`, defines auto-labels for PRs based on file patterns.

## 📦 Deployment

### Build Types

**Development Builds**:

- Include debugging tools
- Connect to Expo dev server
- Internal distribution
- Use: Local development and testing

**Preview Builds**:

- Internal distribution only
- Production-like environment
- No debugging tools
- Use: QA testing, stakeholder review

**Production Builds**:

- App store ready
- Auto-increment versioning
- Optimized and minified
- Use: Public app store releases

### Deployment Strategies

**Strategy 1: OTA Updates (Recommended for JavaScript changes)**

- Free and unlimited
- Deploy in seconds
- No app store review
- No version increment
- Use for: Bug fixes, UI changes, logic updates, asset updates

**Strategy 2: Native Builds (Required for native changes)**

- Uses build credits (30/month free tier)
- Requires app store submission (iOS)
- Version increment required
- Use for: Native module changes, SDK updates, config changes, permissions

### EAS Update Workflow

1. Make JavaScript/asset changes
2. Commit to Git
3. Trigger EAS Update workflow (or run locally)
4. Select target branch (production/preview/development)
5. Update deploys in seconds
6. Users get update on next app launch

### EAS Build Workflow

1. Make native code or configuration changes
2. Commit to Git
3. Trigger EAS Build workflow (or run locally)
4. Select profile and platform
5. Wait for cloud build
6. Download and distribute/submit to stores

### Version Management

- App version: Defined in `app.json` (`version` field)
- Build number: Auto-incremented in production profile
- Update channels: Separate branches for environments

### Distribution

- **Development**: Ad-hoc, internal testers
- **Preview**: TestFlight (iOS), internal testing (Android)
- **Production**: App Store, Google Play

## 🔐 Environment Variables

### Expo Environment Variables

**Prefix**: All client-accessible variables must start with `EXPO_PUBLIC_`

**Access**: Available via `process.env.EXPO_PUBLIC_*`

### Configuration File

**Location**: `config/env.ts`

**Managed Variables**:

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (public, starts with `sb_publishable_...`)
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry error tracking DSN
- `EXPO_PUBLIC_API_URL` — Custom API base URL
- `EXPO_PUBLIC_ENV` — Environment flag (development/production)

**Features**:

- Type-safe access via exported `env` object
- Production validation for required variables
- Default values for development
- App version and build info from Expo config

### Local Development

1. Enable the new API keys in your Supabase Dashboard: `Settings` → `API` → Enable new API key system
2. Copy `.env.example` to `.env` in the repo root
3. Paste your Supabase project URL and publishable key (`EXPO_PUBLIC_SUPABASE_*`)
4. Supply any other `EXPO_PUBLIC_` values (API URL, environment tag, etc.)
5. Restart Expo server to load changes

### Production/EAS

1. Use **EAS secrets** and **Edge Function secrets** for sensitive values
2. Command: `eas secret:create --scope project --name <NAME> --value <VALUE>`
3. Secrets automatically injected during builds
4. No commit to Git required

### Security Best Practices

- Never commit `.env` files
- Use different values per environment
- Rotate keys regularly
- Use minimal permissions for API keys
- Validate required variables at runtime
- **Do not expose secrets** (DB passwords, Supabase secret key, Stytch secrets) to the client; keep them in Edge Function or EAS secrets only

## 🎯 Best Practices

### State Management

- **Client State (Zustand)**: UI toggles, modals, theme, temporary selections, draft data
- **Server State (React Query)**: API responses, database queries, remote data, cached lists
- **Never Mix**: Keep client and server state completely separate
- **Persistence**: Use **AsyncStorage** for non-sensitive UI prefs only; use **SecureStore** for auth/session on mobile; **do not persist PHI**
- **Normalization**: Normalize server state in query client when needed

### Data Fetching

- **Always** use React Query for server data
- **Implement** optimistic updates for better UX
- **Invalidate** queries after mutations
- **Handle** loading and error states explicitly
- **Use** proper query keys for cache management
- **Avoid** fetching in `useEffect` (use React Query)
- **Edge Functions** are the boundary for protected data access

### Forms

- **Always** validate with Zod schemas
- **Use** React Hook Form for performance
- **Extract** complex forms to custom hooks
- **Implement** field-level validation
- **Handle** async validation separately
- **Show** validation errors clearly

### Internationalization

- **All** user-facing text must be translated
- **Use** namespaces to organize translations
- **Test** with different locales
- **Consider** RTL languages for future
- **Extract** translation keys to constants
- **Provide** fallback translations

### Code Quality

- **Format** with Biome before committing (automatic via pre-commit hook)
- **Fix** TypeScript errors immediately
- **Use** strict types, avoid `any`
- **Write** descriptive variable and function names
- **Comment** complex logic, not obvious code
- **Keep** functions small and focused

### Testing

- **Write** E2E tests for critical user flows
- **Use** Maestro studio for interactive development
- **Keep** tests simple and maintainable
- **Test** on both platforms (iOS and Android)
- **Assert** user-visible behavior, not implementation
- **Organize** tests by feature/flow

### Performance

- **Use** FlashList instead of FlatList
- **Memoize** expensive computations
- **Lazy load** routes and components
- **Optimize** images (WebP format)
- **Minimize** re-renders with React.memo
- **Profile** with React DevTools

### Security

- **Never** commit secrets or API keys
- **Use** `EXPO_PUBLIC_` prefix only for non-sensitive data
- **Validate** all user input
- **Sanitize** data before storage
- **Use** HTTPS for all API calls
- **Implement** proper authentication
- **Web**: HttpOnly cookies for sessions; avoid JS-readable tokens
- **DB**: Enforce tenant scoping via RLS (`SET LOCAL app.org_id`) or strict `org_id` filters with service role

### Git & Commits

- **Write** descriptive commit messages
- **Use** conventional commits format (optional but recommended)
- **Keep** commits atomic and focused
- **Review** pre-commit checks before committing
- **Create** feature branches from main
- **Squash** commits when merging PRs

## 🆘 Troubleshooting

### Biome Issues

**Problem**: Biome errors not auto-fixing
**Solution**: Run `bun run format` to apply all fixes

**Problem**: Biome ignoring files
**Solution**: Check `experimentalScannerIgnores` in `biome.json`

**Problem**: VS Code not using Biome
**Solution**: Install Biome extension and set as default formatter in settings

### TypeScript Issues

**Problem**: Type errors in node_modules
**Solution**: Run `bun install` to update types

**Problem**: Path alias not resolving
**Solution**: Restart TypeScript server in VS Code (Cmd/Ctrl + Shift + P → "Restart TypeScript Server")

**Problem**: Type errors after Expo update
**Solution**: Delete `node_modules`, `.expo`, and run `bun install`

### Husky/Git Hooks Issues

**Problem**: Pre-commit hooks not running
**Solution**: Run `bun run prepare` and `chmod +x .husky/pre-commit`

**Problem**: Hooks failing on Windows
**Solution**: Ensure Git Bash or WSL is configured properly

### EAS Build Issues

**Problem**: Build fails with environment variable errors
**Solution**: Verify all `EXPO_PUBLIC_*` secrets are set in EAS

**Problem**: Build fails with native dependency error
**Solution**: Run `bun run prebuild` locally to debug

**Problem**: Can't authenticate EAS
**Solution**: Run `eas login` and verify with `eas whoami`

### EAS Update Issues

**Problem**: Updates not appearing in app
**Solution**: Ensure app is connected to correct update branch/channel

**Problem**: Update fails during publish
**Solution**: Check network connection and EAS service status

### Expo Issues

**Problem**: App won't start after dependency update
**Solution**: Clear cache with `bun start --clear`

**Problem**: Metro bundler errors
**Solution**: Delete `.expo` folder and restart

**Problem**: iOS build fails with pod error
**Solution**: `cd ios && pod install && cd ..`

### React Query Issues

**Problem**: Data not updating after mutation
**Solution**: Ensure query invalidation after mutation success

**Problem**: Stale data showing
**Solution**: Adjust `staleTime` in query client config

### Sentry Issues

**Problem**: Errors not appearing in Sentry
**Solution**: Verify DSN in environment variables

**Problem**: Source maps not working
**Solution**: Check Sentry plugin configuration in `app.json`

### Maestro Issues

**Problem**: Tests failing on CI
**Solution**: Ensure proper device/simulator setup in CI environment

**Problem**: Element not found
**Solution**: Use `maestro studio` to inspect app hierarchy

### General Debugging

**Problem**: App crashes without error
**Solution**: Check Sentry dashboard for crash reports

**Problem**: Slow app performance
**Solution**: Use React DevTools Profiler to identify bottlenecks

**Problem**: Build size too large
**Solution**: Analyze bundle with Metro bundler visualization

## 📚 Resources

### Official Documentation

- **Expo**: [https://docs.expo.dev](https://docs.expo.dev)
- **React Native**: [https://reactnative.dev](https://reactnative.dev)
- **React Query**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **React Hook Form**: [https://react-hook-form.com](https://react-hook-form.com)
- **Zod**: [https://zod.dev](https://zod.dev)
- **Supabase**: [https://supabase.com/docs](https://supabase.com/docs)
- **Stytch**: [https://stytch.com/docs](https://stytch.com/docs)
- **i18next**: [https://www.i18next.com](https://www.i18next.com)
- **Biome**: [https://biomejs.dev](https://biomejs.dev)
- **Maestro**: [https://maestro.mobile.dev](https://maestro.mobile.dev)
- **NativeWind**: [https://nativewind.dev](https://nativewind.dev)
- **Zustand**: [https://zustand-demo.pmnd.rs](https://zustand-demo.pmnd.rs)
- **Sentry (RN)**: [https://docs.sentry.io/platforms/react-native](https://docs.sentry.io/platforms/react-native)

### Learning Resources

- **Expo Router Guide**: File-based routing patterns and best practices
- **React Query Tutorial**: Data fetching, caching, and synchronization
- **TypeScript Handbook**: Advanced TypeScript patterns
- **Tailwind CSS Docs**: Utility-first CSS framework
- **React Navigation**: Deep linking and navigation patterns

### Community

- **Expo Discord**: [https://discord.gg/expo](https://discord.gg/expo)
- **Maestro Discord**: [https://discord.gg/maestro](https://discord.gg/maestro)
- **Biome Discord**: [https://discord.gg/biome](https://discord.gg/biome)
- **React Native Community**: [https://reactnative.dev/community/overview](https://reactnative.dev/community/overview)

### Tools & Utilities

- **EAS CLI Docs**: [https://docs.expo.dev/eas](https://docs.expo.dev/eas)
- **Expo Dev Tools**: [https://docs.expo.dev/debugging/tools](https://docs.expo.dev/debugging/tools)
- **React DevTools**: Component profiling and inspection
- **Flipper**: Mobile app debugging (optional)

### GitHub Actions

- **Expo GitHub Action**: [https://github.com/expo/expo-github-action](https://github.com/expo/expo-github-action)
- **Dependency Review**: [https://github.com/actions/dependency-review-action](https://github.com/actions/dependency-review-action)
- **CodeQL**: [https://github.com/github/codeql-action](https://github.com/github/codeql-action)

### Best Practices & Patterns

- **React Patterns**: [https://reactpatterns.com](https://reactpatterns.com)
- **TypeScript Best Practices**: [https://typescript-eslint.io](https://typescript-eslint.io)
- **Security Checklist**: OWASP Mobile Security Guidelines
- **Performance Guide**: React Native performance optimization

## 🤝 Contributing

For day-to-day expectations, see the [Repository Guidelines](AGENTS.md) covering project structure, commands, and review checklists.

### Getting Started

We manage pull requests with [Graphite.dev](https://graphite.dev) so stacked diffs stay reviewable.

1. Fork (or clone with access) and install the CLI: `brew install withgraphite/tap/graphite` (or see their docs for other installers).
2. Authenticate once: `gt auth login`, then initialize in the repo root: `gt init`.
3. Sync the latest `main`: `gt repo sync` (or `gt upstack onto origin/main` when rebasing a stack).
4. Create a branch with Graphite: `gt branch create feature/<slug>`.
5. Make your changes and run `bun run format && bun run type-check` (plus Maestro flows as needed).
6. Stage files (`git add .`) and create commits via `gt commit`.
7. Submit your stack: `gt stack submit` (or `gt submit` for single-PR flows); Graphite opens/updates GitHub PRs automatically.
8. Use `gt stack list` / `gt status` to monitor stacks and `gt downstack` if you must edit earlier commits.

### Daily Command Loop

- `gt repo sync` — pull latest `origin/main`, prune merged stacks, and refresh local state.
- `gt branch create feature/<slug>` — start a new branch in the stack (one branch = one upcoming PR).
- `git add <files>` + `bun run format && bun run type-check` (and Maestro flows when relevant) — stage and verify changes.
- `gt commit -m "feat: ..."` — record commits with Graphite so stack metadata stays accurate.
- `gt status` / `gt stack list` — inspect stack order and readiness before submitting.
- `gt stack submit` (`gt submit` for a single branch) — open/update GitHub PRs for each branch in the stack.
- `gt amend` + `gt stack submit --update` — adjust the latest commit after feedback and refresh the PR.
- `gt downstack <branch>` / `gt upstack` — jump to earlier or later branches when you need to edit part of the stack.
- `gt branch delete <branch>` — remove merged or abandoned branches once GitHub PRs are closed.
### Code Standards

- Follow existing code style (enforced by Biome)
- Write TypeScript with strict types
- Add translations for new user-facing text
- Update documentation for significant changes
- Test on both iOS and Android

### PR Guidelines

- Use Graphite’s PR templates; include clear “what/why” context and link related issues.
- Keep stacks small—`gt stack submit` should only include review-ready commits.
- Ensure CI checks pass (`bun run lint`, `bun run type-check`, Maestro flows) before updating the stack.
- Request review via Graphite or GitHub, and use `gt amend` + `gt stack submit --update` to address feedback.

## 📄 License

MIT License — See LICENSE file for details

---

**Built with Excellence**
⚡ Expo • 🎨 NativeWind • ⚡ Biome • 🎭 Maestro • 🔄 React Query • 🐻 Zustand

**Version**: 1.0.0
**Platform**: iOS, Android, Web
**Framework**: React Native 0.81.4
**SDK**: Expo 54
