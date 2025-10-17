# Setup Guide

This project has been configured with several production-ready features. Here's what's included and how to use them:

## 🎯 Features Added

### 1. React Query (@tanstack/react-query)

- **Purpose**: Server state management, data fetching, caching
- **Location**: `providers/QueryProvider.tsx`
- **Usage**: See `api/hooks/useExample.ts` for patterns
- **Documentation**: https://tanstack.com/query/latest

### 2. React Hook Form + Zod

- **Purpose**: Form management with type-safe validation
- **Example**: `components/forms/ExampleForm.tsx`
- **Documentation**:
  - React Hook Form: https://react-hook-form.com/
  - Zod: https://zod.dev/

### 3. Environment Variables

- **Setup**: Create a `.env` file in the root directory
- **Pattern**: Use `EXPO_PUBLIC_` prefix for client-side variables
- **Configuration**: `config/env.ts`
- **Example variables**:
  ```env
  EXPO_PUBLIC_SUPABASE_URL=your-url
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key
  EXPO_PUBLIC_ENV=development
  ```
- **For EAS builds**: Use EAS secrets
  ```bash
  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <value>
  ```

### 4. Husky + lint-staged

- **Purpose**: Pre-commit hooks for code quality
- **Setup**: Already configured, runs automatically on `git commit`
- **What it does**:
  - Runs ESLint and fixes issues
  - Formats code with Prettier
  - Ensures only quality code is committed

### 5. GitHub Actions CI/CD

- **Location**: `.github/workflows/`
- **Workflows**:
  - `ci.yml` - Runs on push/PR to main/develop
    - Linting
    - Type checking
  - `eas-build.yml` - Manual trigger for EAS builds
- **Setup**: Add `EXPO_TOKEN` to GitHub Secrets
  - Get token: `eas login && eas whoami`
  - Add to: GitHub Repo → Settings → Secrets → New repository secret

### 6. Internationalization (i18next)

- **Languages**: English (en) and Spanish (es)
- **Location**: `locales/*.json`
- **Configuration**: `lib/i18n.ts`
- **Hook**: `hooks/useI18n.ts`
- **Usage**:

  ```typescript
  import { useI18n } from '@/hooks/useI18n';

  function MyComponent() {
    const { t, changeLanguage } = useI18n();
    return <Text>{t('common.welcome')}</Text>;
  }
  ```

### 7. API Client Structure

- **Supabase**: `api/client.ts` - Pre-configured client
- **Custom API**: `api/client.ts` - Generic fetch wrapper
- **Hooks**: `api/hooks/` - React Query hooks for data fetching
- **Pattern**: Copy and modify `useExample.ts` for your data models

## 📦 Project Structure

```
calico/
├── api/                    # API clients and hooks
│   ├── client.ts          # Supabase & API client
│   └── hooks/             # React Query hooks
├── app/                   # Expo Router pages
├── components/            # React components
│   ├── forms/            # Form components
│   └── nativewindui/     # UI components
├── config/               # Configuration files
│   └── env.ts           # Environment variables
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
│   └── i18n.ts          # i18n configuration
├── locales/              # Translation files
├── providers/            # React context providers
└── store/                # Zustand stores
```

## 🚀 Getting Started

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Set up environment variables**:
   - Create `.env` file (see `.env.example`)
   - Add your Supabase credentials

3. **Run development server**:

   ```bash
   bun start
   ```

4. **For iOS**:

   ```bash
   bun ios
   ```

5. **For Android**:

   ```bash
   bun android
   ```

6. **For Web**:
   ```bash
   bun web
   ```

## 🔨 Development Scripts

- `bun start` - Start development server
- `bun run lint` - Run ESLint and Prettier check
- `bun run format` - Fix linting and formatting issues
- `bun run type-check` - Run TypeScript type checking
- `bun run build:dev` - Build development version
- `bun run build:preview` - Build preview version
- `bun run build:prod` - Build production version

## 📱 Example Usage

### Using React Query with Supabase

```typescript
import { useExampleItems, useCreateExampleItem } from '@/api/hooks/useExample';

function MyComponent() {
  const { data, isLoading, error } = useExampleItems();
  const createItem = useCreateExampleItem();

  const handleCreate = () => {
    createItem.mutate({ name: 'New Item' });
  };

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      {data?.map(item => <Text key={item.id}>{item.name}</Text>)}
      <Button onPress={handleCreate}>Create Item</Button>
    </View>
  );
}
```

### Using Forms

```typescript
import { ExampleForm } from '@/components/forms/ExampleForm';

function MyScreen() {
  const handleSubmit = async (data) => {
    console.log('Form data:', data);
    // Process form data
  };

  return <ExampleForm onSubmit={handleSubmit} />;
}
```

### Using i18n

```typescript
import { useI18n } from '@/hooks/useI18n';

function SettingsScreen() {
  const { t, changeLanguage, currentLanguage } = useI18n();

  return (
    <View>
      <Text>{t('settings.title')}</Text>
      <Button onPress={() => changeLanguage('es')}>
        Change to Spanish
      </Button>
    </View>
  );
}
```

## 🔐 Environment Variables

### Development

Create a `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ENV=development
```

### Production (EAS)

Set secrets for EAS:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-anon-key
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value production
```

## 🎨 State Management

### Client State (UI, local data)

- **Tool**: Zustand
- **Location**: `store/`
- **Use for**: UI state, local preferences, client-only data

### Server State (API data, remote data)

- **Tool**: React Query
- **Location**: `api/hooks/`
- **Use for**: Supabase queries, API calls, remote data

## 📝 Notes

- All features are **Expo Go compatible**
- Pre-commit hooks will run automatically
- GitHub Actions require `EXPO_TOKEN` secret
- Environment variables must start with `EXPO_PUBLIC_` to be available in client
- Use React Query for server data, Zustand for client state

## 🆘 Troubleshooting

### Husky hooks not running

```bash
bun run prepare
```

### Type errors in i18n

```bash
# The types are inferred from the JSON files
# Make sure locales/*.json files are valid JSON
```

### EAS build fails

- Check that all `EXPO_PUBLIC_*` secrets are set
- Verify EAS project is linked: `eas whoami`
- Check build logs: `eas build:list`

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Query Guide](https://tanstack.com/query/latest/docs/react/overview)
- [React Hook Form Guide](https://react-hook-form.com/get-started)
- [Zod Documentation](https://zod.dev/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [i18next Documentation](https://www.i18next.com/)
