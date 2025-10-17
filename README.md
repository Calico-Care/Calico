To build for development:

1. cd calico
2. bun install
3. eas build --profile=development
4. bun run start

To create a build to share with others:

1. cd calico
2. bun install
3. eas build --profile=preview

To add additional ios users:

eas device:create

To create a GitHub repository for this project, run:
npx rn-new --publish


