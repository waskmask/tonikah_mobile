module.exports = ({ config }) => {
    return {
        ...config,
        extra: {
            ...config.extra,
            APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'dev',
        },
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
            googleServicesFile: './google-services.json', // only if using Firebase later
        },
    };
};