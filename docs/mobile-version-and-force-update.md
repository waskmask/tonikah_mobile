# Mobile Versioning and Forced Updates

Use this runbook when publishing a new toNikah iOS or Android release and when
requiring users on an older native build to update.

## Version and Build Number

The app has two different version values:

- **App version** is the public version shown in the stores, such as `1.1.1`
  or `1.1.2`. It is configured in `app.json` under `expo.version`.
- **Native build number** is the integer used by the forced-update check. iOS
  calls it the build number and Android calls it the version code.

This project uses remote EAS versioning and production auto-increment in
`eas.json`. Always check the completed EAS build for the actual native build
number. Do not assume the build number from the public app version.

Example:

| Release | Public app version | Example native build |
| --- | --- | --- |
| Current release | `1.1.1` | `1` |
| Second release | `1.1.2` | `2` |

The native build values above are examples. Use the values reported by EAS.

## Prepare Version 1.1.2

Change the version in `app.json`:

```json
{
  "expo": {
    "version": "1.1.2"
  }
}
```

Create production builds:

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest build --profile production --platform android
```

Record each completed build's native build number. The iOS and Android build
numbers can be different.

Submit both builds:

```bash
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

Wait until the new version is approved and publicly available in each store
before raising that platform's minimum build.

## Backend Configuration

The app reads the public endpoint:

```text
GET /api/mobile-config
```

The backend configuration uses these environment variables:

```env
MOBILE_IOS_MINIMUM_BUILD=1
MOBILE_IOS_STORE_URL=https://apps.apple.com/app/idYOUR_APP_ID
MOBILE_ANDROID_MINIMUM_BUILD=1
MOBILE_ANDROID_STORE_URL=https://play.google.com/store/apps/details?id=com.tonikah.app
MOBILE_FORCE_UPDATE_AFTER=
```

- `MOBILE_IOS_MINIMUM_BUILD` is the oldest allowed iOS native build.
- `MOBILE_ANDROID_MINIMUM_BUILD` is the oldest allowed Android native build.
- Store URLs must point directly to the published app.
- An empty `MOBILE_FORCE_UPDATE_AFTER` makes a raised minimum effective
  immediately.
- `MOBILE_FORCE_UPDATE_AFTER` may contain an ISO 8601 UTC timestamp such as
  `2026-12-01T00:00:00Z` to schedule enforcement.
- A platform without a valid store URL is not blocked, even if its minimum
  build is higher.

After changing production environment variables, restart the backend with the
updated environment:

```bash
pm2 restart tonikah-api --update-env
```

Confirm the deployed configuration:

```bash
curl https://api.tonikah.com/api/mobile-config
```

## Safe Release Order

1. Deploy the backend endpoint with current minimum build values.
2. Publish the mobile app containing the forced-update gate.
3. Publish version `1.1.2` to both stores.
4. Confirm that each store page offers `1.1.2` publicly.
5. Set each platform minimum to the actual native build for `1.1.2`.
6. Restart the backend and verify `/api/mobile-config`.
7. Open an older app build and confirm that the update screen opens the
   correct store page.

Do not raise a platform's minimum before its store release is available. Doing
so can leave users on that platform unable to continue or install the required
version.

## Example Activation

If EAS reports iOS build `2` and Android build `5` for version `1.1.2`, use:

```env
MOBILE_IOS_MINIMUM_BUILD=2
MOBILE_ANDROID_MINIMUM_BUILD=5
MOBILE_FORCE_UPDATE_AFTER=
```

To schedule the requirement for December 1, 2026 at midnight UTC instead:

```env
MOBILE_IOS_MINIMUM_BUILD=2
MOBILE_ANDROID_MINIMUM_BUILD=5
MOBILE_FORCE_UPDATE_AFTER=2026-12-01T00:00:00Z
```

## Rollback

To stop forcing an update, lower each minimum to the oldest build that should
remain usable, or temporarily remove that platform's store URL. Restart PM2
after changing the environment and verify the public endpoint again.
