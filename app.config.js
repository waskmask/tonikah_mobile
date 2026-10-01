const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('@expo/config-plugins');

const googleServicesPath = './google-services.json';
const iosGoogleServicesPath = './GoogleService-Info.plist';
const hasGoogleServicesFile = fs.existsSync(path.resolve(__dirname, googleServicesPath));
const hasIosGoogleServicesFile = fs.existsSync(path.resolve(__dirname, iosGoogleServicesPath));

const withPhoneOnlyAndroid = (config) =>
    withAndroidManifest(config, (androidConfig) => {
        androidConfig.modResults.manifest['supports-screens'] = [
            {
                $: {
                    'android:smallScreens': 'true',
                    'android:normalScreens': 'true',
                    'android:largeScreens': 'false',
                    'android:xlargeScreens': 'false',
                    'android:anyDensity': 'true',
                },
            },
        ];
        return androidConfig;
    });

module.exports = ({ config }) => {
    return {
        ...config,
        extra: {
            ...config.extra,
            APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'dev',
        },
        plugins: [
            ...(config.plugins || []),
            '@react-native-community/datetimepicker',
            [
                'expo-font',
                {
                    fonts: [
                        './node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf',
                        './node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
                        './node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf',
                        './node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf',
                        './node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
                        './node_modules/@expo-google-fonts/noto-sans-arabic/400Regular/NotoSansArabic_400Regular.ttf',
                        './node_modules/@expo-google-fonts/noto-sans-arabic/600SemiBold/NotoSansArabic_600SemiBold.ttf',
                        './node_modules/@expo-google-fonts/noto-sans-arabic/700Bold/NotoSansArabic_700Bold.ttf',
                    ],
                },
            ],
            'expo-asset',
            'expo-image',
            'expo-audio',
            ['react-native-waveform-recorder', { microphonePermission: false, backgroundRecording: false }],
            'expo-notifications',
            'expo-status-bar',
            'expo-web-browser',
            withPhoneOnlyAndroid,
        ],
        ios: {
            ...config.ios,
            ...(hasIosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesPath } : {}),
            infoPlist: {
                ...config.ios?.infoPlist,
                CFBundleURLTypes: [
                    {
                        CFBundleURLSchemes: [
                            'com.googleusercontent.apps.349696991792-vkr3uaifi2i7ot8v39bjh79sf304f90f',
                        ],
                    },
                ],
            },
        },
        android: {
            ...config.android,
            ...(hasGoogleServicesFile ? { googleServicesFile: googleServicesPath } : {}),
            softwareKeyboardLayoutMode: 'resize',
        },
    };
};
