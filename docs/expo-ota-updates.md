# Expo OTA Updates

## First Release

OTA is configured for version 1.1.2 using the existing EAS project. Create new
native builds after these changes. Previously installed builds and builds
already queued before this configuration cannot gain OTA support retroactively.
No update is published by changing these files.

- Production builds receive the production channel and use production APIs.
- Internal preview builds receive the preview channel and use dev APIs.
- Development clients continue using Metro; test OTA with release builds.
- Updates check on cold launch without waiting for the network. The embedded
  bundle or cached update starts immediately; completed downloads are used on
  a later cold launch. No automatic mid-conversation reload is implemented.
- Runtime policy is appVersion. Only matching platform/runtime builds receive
  an update. Native modules, permissions, SDK or native configuration changes
  require a version bump and fresh builds. Never publish incompatible JS to
  an existing runtime. Build-number increments alone do not change the runtime.
- The API minimum-build force-update gate is unchanged.

## Build And Test

```bash
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
```

Use the production builds in TestFlight and Play Internal Testing before public
release. Preview is ad hoc on iOS and cannot be submitted to TestFlight.

## Publish Deliberately

The commands below are Git Bash commands. Build-profile env values are not
automatically applied by eas update. Keep the specified environment and API
selection consistent with the target build, including all other public env vars.
Check EAS environment variables for conflicting EXPO_PUBLIC_APP_ENV values.

```bash
EXPO_PUBLIC_APP_ENV=dev npx eas-cli@latest update --channel preview --environment preview --message "Describe tested changes"
EXPO_PUBLIC_APP_ENV=prod npx eas-cli@latest update --channel production --environment production --message "Describe tested changes"
```

Do not promote a dev-API preview bundle to production. Publish from the same
reviewed commit with production settings and verify the bundle's API target.
Production-channel updates can reach all compatible production builds, including
TestFlight builds and publicly installed copies; TestFlight is not an isolated
OTA channel. Do not publish experimental changes there after public release.

For a first smoke test, publish a harmless visible change to preview, cold-launch
online to download, then fully close/reopen to confirm application. Check offline
startup, login, messaging, and the deployed runtime/channel in the Expo dashboard.
Review the deployment and use Expo's rollback controls if a regression occurs;
an OTA rollback is not a rollback of API or database changes.

OTA is for compatible fixes/assets and must comply with store policies. It does
not install a new native binary or change the store version/build number.
