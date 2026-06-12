const fs = require('fs');
const path = require('path');

const googleServicesPath = './google-services.json';
const hasGoogleServicesFile = fs.existsSync(path.resolve(__dirname, googleServicesPath));

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
            'expo-status-bar',
            'expo-web-browser',
        ],
        ios: {
            ...config.ios,
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
        },
    };
};
