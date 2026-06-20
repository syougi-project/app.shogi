import 'dotenv/config';

const IOS_ADMOB_APP_ID = 'ca-app-pub-4722276667311883~4369476061';
const IOS_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-4722276667311883/8991247351';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: '真名仮名',
  slug: 'frontend',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'frontend',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.manakana.shogi',
    buildNumber: '1',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    [
      'react-native-google-mobile-ads',
      {
        iosAppId: IOS_ADMOB_APP_ID,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    admobIosInterstitialUnitId:
      process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID ?? IOS_INTERSTITIAL_AD_UNIT_ID,
    eas: {
      projectId: '865f1aca-5b9d-41a2-b2d8-455b12075ca2',
    },
  },
};

export default config;
