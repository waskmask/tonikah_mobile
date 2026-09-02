# Android Development Runbook

Use this runbook to run the toNikah React Native app in an Android Studio
emulator and on a physical Android device from the same Expo Metro server.

The app uses native modules, including Google Sign-In and in-app purchases.
Use the toNikah Expo development build, not Expo Go.

## Environment

Development is the default app environment. It currently uses:

- API: `https://devapi.tonikah.com/api`
- Web checkout: `https://dev.tonikah.com`

Commands below should be run from:

```bash
cd /d/Tonikah-dev/apps/React-Native-APP
```

Install dependencies after cloning, pulling dependency changes, or changing
`package-lock.json`:

```bash
npm install
```

## Daily Start

1. Open Android Studio.
2. Open Device Manager and start the required Android virtual device.
3. Start Expo and clear the Metro cache:

```bash
npx expo start --dev-client --clear
```

4. Press `a` in the Expo terminal to open the app in the running emulator.
5. Open the installed toNikah development app on the physical phone and scan
   the same QR code.

The computer and physical phone must normally be connected to the same Wi-Fi
network. One Metro process can serve both devices.

## Build a Downloadable Android Dev App

Create a development APK through Expo Application Services (EAS):

```bash
npx eas-cli login
npx eas-cli build --profile development --platform android
```

When the build finishes:

1. Open the build URL printed by EAS.
2. Download the APK on the physical Android device.
3. Allow installation from the browser or file manager when Android asks.
4. Install and open the toNikah development app.
5. Run `npx expo start --dev-client --clear` on the computer.
6. Scan the Metro QR code from the development app.

Rebuild the development APK when native dependencies, Expo plugins, Android
configuration, permissions, or native assets change. Normal JavaScript and
TypeScript changes only require restarting or reloading Metro.

## Install Locally Through USB

Android Studio and the Android SDK must be installed. Enable Developer Options
and USB debugging on the phone, connect it, and verify the device:

```bash
adb devices
```

Build and install the native development app on a connected device or running
emulator:

```bash
npx expo run:android --device
```

After the development app is installed, use the normal daily command:

```bash
npx expo start --dev-client --clear
```

## Connection Troubleshooting

If the emulator does not open:

```bash
adb devices
```

Confirm that an emulator is listed as `device`, then press `a` again in the
Expo terminal.

If the physical phone cannot connect over LAN:

1. Confirm the phone and computer are on the same Wi-Fi network.
2. Allow Node.js and Expo through Windows Firewall on private networks.
3. Disable a VPN temporarily if it prevents local network access.
4. Start Expo using a tunnel:

```bash
npx expo start --dev-client --clear --tunnel
```

Tunnel mode is slower but does not require the phone to reach the computer's
local IP address directly.

If port `8081` is already occupied, stop the existing Metro process before
starting another one. Do not run multiple Metro servers for this project unless
they use intentionally different ports.

## Useful Terminal Controls

While Expo is running:

- `a`: open Android
- `r`: reload connected apps
- `j`: open the debugger
- `m`: open the developer menu
- `Ctrl+C`: stop Metro

## Payment Testing Note

External card checkout can use the development API and
`https://dev.tonikah.com`. Native Apple or Google in-app purchases require the
corresponding store sandbox or internal-testing setup and cannot be fully
validated with Expo Go.
