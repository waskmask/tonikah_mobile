const fs = require('fs');
const path = require('path');

const googleServicesPath = './google-services.json';
const iosGoogleServicesPath = './GoogleService-Info.plist';
const hasGoogleServicesFile = fs.existsSync(path.resolve(__dirname, googleServicesPath));
const hasIosGoogleServicesFile = fs.existsSync(path.resolve(__dirname, iosGoogleServicesPath));

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
            'expo-font',
            'expo-image',
            'expo-audio',
            'expo-notifications',
            'expo-status-bar',
            'expo-web-browser',
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
