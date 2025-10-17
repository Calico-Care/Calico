# Calico

A production-ready React Native app built with Expo.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun start

# Run on specific platform
bun ios
bun android
bun web
```

## 📚 Documentation

See [SETUP.md](./SETUP.md) for comprehensive documentation on:

- Features and tools included
- Environment variable setup
- Project structure
- Usage examples
- Development workflows

## 🛠️ Key Features

- ⚡️ **Expo SDK 54** with Expo Router
- 🎨 **NativeWind** (Tailwind CSS for React Native)
- 🔄 **React Query** for server state management
- 📝 **React Hook Form + Zod** for forms and validation
- 🌍 **i18next** for internationalization
- 🔐 **Supabase** ready to use
- 📊 **Sentry** for error tracking
- 🎯 **TypeScript** for type safety
- ✅ **ESLint + Prettier** with pre-commit hooks
- 🚀 **GitHub Actions** CI/CD
- 📦 **Zustand** for client state

## 📱 Building

### Development Build

```bash
bun run build:dev
```

### Preview Build

```bash
bun run build:preview
```

### Production Build

```bash
bun run build:prod
```

## 📝 Scripts

- `bun start` - Start Expo dev server
- `bun run lint` - Run linter and format check
- `bun run format` - Fix linting and formatting
- `bun run type-check` - Run TypeScript checks

## 🔧 Additional Setup

### Add iOS Test Users

```bash
eas device:create
```

### Publish to GitHub

```bash
npx rn-new --publish
```

## 📖 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [Setup Guide](./SETUP.md)
- [React Query Docs](https://tanstack.com/query/latest)
- [Supabase Docs](https://supabase.com/docs)
