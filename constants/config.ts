const ENV = {
    dev: {
        API_URL: 'https://devapi.tonikah.com/api',
        WEB_APP_ORIGIN: 'https://dev.tonikah.com',
        FORGOT_PASSWORD_URL: 'https://dev.tonikah.com/forgot-pass',
        TERMS_URL: 'https://dev.tonikah.com/terms',
        PRIVACY_URL: 'https://dev.tonikah.com/privacy-policy',
        GOOGLE_WEB_CLIENT_ID: '349696991792-eru99qqnn7b3pmem2ihsf08evb57g1e3.apps.googleusercontent.com',
        GOOGLE_IOS_CLIENT_ID: '349696991792-vkr3uaifi2i7ot8v39bjh79sf304f90f.apps.googleusercontent.com',
        GOOGLE_MAPS_API_KEY: 'AIzaSyADiPz9OKUiTSQJJ1UXyeIYC4hibjxqCK4',
    },
    staging: {
        API_URL: 'https://devapi.tonikah.com/api',
        WEB_APP_ORIGIN: 'https://dev.tonikah.com',
        FORGOT_PASSWORD_URL: 'https://dev.tonikah.com/forgot-pass',
        TERMS_URL: 'https://dev.tonikah.com/terms',
        PRIVACY_URL: 'https://dev.tonikah.com/privacy-policy',
        GOOGLE_WEB_CLIENT_ID: '349696991792-eru99qqnn7b3pmem2ihsf08evb57g1e3.apps.googleusercontent.com',
        GOOGLE_IOS_CLIENT_ID: '349696991792-vkr3uaifi2i7ot8v39bjh79sf304f90f.apps.googleusercontent.com',
        GOOGLE_MAPS_API_KEY: 'AIzaSyADiPz9OKUiTSQJJ1UXyeIYC4hibjxqCK4',
    },
    prod: {
        API_URL: 'https://api.tonikah.com/api',
        WEB_APP_ORIGIN: 'https://tonikah.com',
        FORGOT_PASSWORD_URL: 'https://tonikah.com/forgot-pass',
        TERMS_URL: 'https://tonikah.com/terms',
        PRIVACY_URL: 'https://tonikah.com/privacy-policy',
        GOOGLE_WEB_CLIENT_ID: '349696991792-eru99qqnn7b3pmem2ihsf08evb57g1e3.apps.googleusercontent.com',
        GOOGLE_IOS_CLIENT_ID: '349696991792-vkr3uaifi2i7ot8v39bjh79sf304f90f.apps.googleusercontent.com',
        GOOGLE_MAPS_API_KEY: 'AIzaSyADiPz9OKUiTSQJJ1UXyeIYC4hibjxqCK4',
    }
};

const getEnv = () => {
    const env = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
    return (ENV as Record<string, typeof ENV.dev>)[env] || ENV.dev;
};

export const Config = getEnv();
