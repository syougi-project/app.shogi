const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const enableAdMob = process.env.EXPO_PUBLIC_ENABLE_ADMOB === 'true';
const adMobStubPath = path.resolve(__dirname, 'src/lib/ads/react-native-google-mobile-ads.stub.ts');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!enableAdMob && moduleName === 'react-native-google-mobile-ads') {
    return {
      filePath: adMobStubPath,
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
