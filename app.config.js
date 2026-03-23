const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');
const appJson = require('./app.json');

const ADMOB_ANDROID_APPLICATION_ID_META_KEY = 'com.google.android.gms.ads.APPLICATION_ID';
const AD_ID_PERMISSION = 'com.google.android.gms.permission.AD_ID';
const NETWORK_STATE_PERMISSION = 'android.permission.ACCESS_NETWORK_STATE';
const DEFAULT_ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const DEFAULT_ADMOB_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

const parseBoolean = (value) => {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const normalize = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeBasePath = (value) => {
  const text = normalize(value);
  if (!text) {
    return undefined;
  }
  const withLeadingSlash = text.startsWith('/') ? text : `/${text}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

const withAdMobAppIds = (config, { androidAppId, iosAppId }) => {
  let nextConfig = withAndroidManifest(config, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults
    );
    AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(
      mainApplication,
      ADMOB_ANDROID_APPLICATION_ID_META_KEY
    );

    if (androidAppId) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        ADMOB_ANDROID_APPLICATION_ID_META_KEY,
        androidAppId
      );
    }

    AndroidConfig.Permissions.ensurePermission(modConfig.modResults, AD_ID_PERMISSION);
    AndroidConfig.Permissions.ensurePermission(modConfig.modResults, NETWORK_STATE_PERMISSION);

    return modConfig;
  });

  nextConfig = withInfoPlist(nextConfig, (modConfig) => {
    if (iosAppId) {
      modConfig.modResults.GADApplicationIdentifier = iosAppId;
    } else {
      delete modConfig.modResults.GADApplicationIdentifier;
    }
    return modConfig;
  });

  return nextConfig;
};

const expoConfig = appJson.expo ?? {};
const basePlugins = Array.isArray(expoConfig.plugins) ? expoConfig.plugins : [];
  const pluginsWithoutAdMob = basePlugins.filter((pluginEntry) => {
    if (Array.isArray(pluginEntry)) {
      return pluginEntry[0] !== 'react-native-google-mobile-ads';
    }
    return pluginEntry !== 'react-native-google-mobile-ads';
  });

const skipAdMobPlugin = parseBoolean(process.env.EXPO_SKIP_ADMOB_PLUGIN);
const baseUrlOverride = normalizeBasePath(process.env.EXPO_WEB_BASE_URL);
const mergedExperiments = {
  ...(expoConfig.experiments ?? {}),
  ...(baseUrlOverride ? { baseUrl: baseUrlOverride } : {}),
};
const baseExpoConfig = {
  ...expoConfig,
  experiments: mergedExperiments,
  plugins: pluginsWithoutAdMob,
};

const androidAppId = normalize(process.env.ADMOB_ANDROID_APP_ID) ?? DEFAULT_ADMOB_ANDROID_APP_ID;
const iosAppId = normalize(process.env.ADMOB_IOS_APP_ID) ?? DEFAULT_ADMOB_IOS_APP_ID;
let finalExpoConfig = baseExpoConfig;

if (!skipAdMobPlugin) {
  const admobEnabled = parseBoolean(process.env.EXPO_PUBLIC_ADMOB_ENABLED);
  const shouldAttachAdMobConfig = admobEnabled || Boolean(androidAppId) || Boolean(iosAppId);

  if (shouldAttachAdMobConfig) {
    finalExpoConfig = withAdMobAppIds(baseExpoConfig, { androidAppId, iosAppId });
  }
}

module.exports = finalExpoConfig;
