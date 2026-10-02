# iOS Development Runbook

Use this runbook to install the toNikah React Native app on registered iPhones
through EAS Build. The app uses native modules, so use a development or preview
build, not Expo Go.

## Choose the Build

Register the iPhone once using `npx eas-cli@latest device:create`, then choose
**one** build profile:

| Goal | Build command | Needs Metro? | After a JavaScript change |
| --- | --- | --- | --- |
| Test the app's standalone behavior or share it with registered testers | `npx eas-cli@latest build --profile preview --platform ios` | No | Build a new preview IPA |
| Develop with Fast Refresh on your iPhone | `npx eas-cli@latest build --profile development --platform ios` | Yes | Reload the app from Metro |

For a realistic keyboard-animation check, use **preview**. The commands below
describe both workflows separately; they are alternatives, not steps to run
one after the other. With the current bundle identifier, installing one profile
replaces the other on the same iPhone.

## Environment

Commands below run from the React Native project directory. In PowerShell:

```powershell
Set-Location D:\Tonikah-dev\apps\React-Native-APP
npm install
```

Cloud iOS builds work from Windows; Xcode and the iOS Simulator require a Mac.
You need access to the project's Expo account and a paid Apple Developer team
with permission to manage signing. This project uses iOS bundle identifier
`com.tonikah.app`. Unless `EXPO_PUBLIC_APP_ENV` is set differently for the
build, the app uses the development API at `https://devapi.tonikah.com/api`.

## Register Each Test iPhone

Do this before building an internally distributed app for a new iPhone:

```powershell
npx eas-cli@latest login
npx eas-cli@latest device:create
```

1. Select the project's Expo account and the correct Apple Developer team.
2. Choose the website/link registration option.
3. Open the registration URL on the iPhone in Safari.
4. Download the profile and install it in iPhone Settings when prompted.
5. Finish the registration page and check the device list:

```powershell
npx eas-cli@latest device:list
```

Register every teammate's iPhone before starting the build. An ad hoc iOS
build installs only on device UDIDs included in its signing profile. Adding a
device later requires another build or re-signing the existing build.

## Build a Standalone iOS Preview

The existing `preview` profile in `eas.json` has `distribution: internal`.
Build its installable `.ipa` with:

```powershell
npx eas-cli@latest build --profile preview --platform ios
```

On the first build, follow the prompts to sign in to Apple, select registered
devices, and let EAS manage the distribution certificate and provisioning
profile. Complete any pending Apple Developer agreements in the Apple portal
if signing fails. Do not add Apple passwords or signing files to this repo.

When the build finishes, open the EAS install link or QR code on a registered
iPhone and follow the on-device install prompts. Enable Developer Mode in
Settings > Privacy & Security if iOS requires it, then restart the phone when
prompted. This preview contains its JavaScript bundle and does not need Metro.
Share the EAS link only with intended testers; access to the link alone does
not make an unregistered iPhone eligible to install it.

Rebuild the preview when testers need changes to bundled JavaScript, assets,
native dependencies, plugins, permissions, or configuration. A preview build
is not a TestFlight build and is not submitted to the App Store.

## Build an iOS Development App

For daily Fast Refresh testing on a registered iPhone:

```powershell
npx eas-cli@latest build --profile development --platform ios
```

Install the development build from its EAS link. Then start Metro from the
project directory:

```powershell
npx expo start --dev-client --clear
```

Open the installed development app on the iPhone and scan the Metro QR code.
The phone and computer should be on the same network. If local networking is
blocked, try `npx expo start --dev-client --clear --tunnel` (slower). JavaScript
and TypeScript changes normally need only a Metro reload; native changes need
a new development build.

Both EAS profiles currently use `com.tonikah.app`, so a preview installation
and a development installation replace each other on the same iPhone. Do not
expect two separate app icons or independent app data.

## Troubleshooting

- **Apple sign-in fails:** Confirm the Apple Developer team membership is
  active, accept new agreements in the Apple portal, complete two-factor
  authentication, and retry. A temporary Apple portal error may need time.
- **Build succeeds but will not install:** Confirm the iPhone appears in
  `eas device:list` and was included in the build's provisioning profile.
  Rebuild or re-sign after adding a device. Newly registered devices on a new
  or recently renewed Apple membership may take 24-72 hours to be usable.
- **App opens but cannot load Metro:** Confirm this is the development build,
  Metro is running, and the phone can reach the computer. Preview builds do
  not connect to Metro.
- **Tester needs a public install link without device registration:** Use
  TestFlight instead; ad hoc preview links cannot bypass Apple's device list.
- **Native purchases or push behavior differs:** Test these on the signed
  physical iPhone with the appropriate Apple sandbox and notification setup.

## References

- [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo iOS device registration and development builds](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [Expo sharing development builds](https://docs.expo.dev/develop/development-builds/share-with-your-team/)
