const parseBoolean = (value) => {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const skipAdMob = parseBoolean(process.env.EXPO_SKIP_ADMOB_PLUGIN);

module.exports = {
  dependencies: skipAdMob
    ? {
        'react-native-google-mobile-ads': {
          platforms: {
            android: null,
            ios: null,
          },
        },
      }
    : {},
};
