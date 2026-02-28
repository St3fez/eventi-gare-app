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

module.exports = ({ config }) => {
  const basePlugins = Array.isArray(config.plugins) ? config.plugins : [];
  const pluginsWithoutAdMob = basePlugins.filter((pluginEntry) => {
    if (Array.isArray(pluginEntry)) {
      return pluginEntry[0] !== 'react-native-google-mobile-ads';
    }
    return pluginEntry !== 'react-native-google-mobile-ads';
  });

  const admobEnabled = parseBoolean(process.env.EXPO_PUBLIC_ADMOB_ENABLED);
  const androidAppId = normalize(process.env.ADMOB_ANDROID_APP_ID);
  const iosAppId = normalize(process.env.ADMOB_IOS_APP_ID);
  const shouldAttachAdMobPlugin = admobEnabled || Boolean(androidAppId) || Boolean(iosAppId);

  if (!shouldAttachAdMobPlugin) {
    return {
      ...config,
      plugins: pluginsWithoutAdMob,
    };
  }

  const googleMobileAdsPluginConfig = {
    delay_app_measurement_init: true,
  };

  if (androidAppId) {
    googleMobileAdsPluginConfig.android_app_id = androidAppId;
  }
  if (iosAppId) {
    googleMobileAdsPluginConfig.ios_app_id = iosAppId;
  }

  return {
    ...config,
    plugins: [...pluginsWithoutAdMob, ['react-native-google-mobile-ads', googleMobileAdsPluginConfig]],
  };
};
