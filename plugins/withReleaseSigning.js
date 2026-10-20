// Re-applies the Play upload-key signing after every `expo prebuild` (android/ is generated and gitignored).
// Credentials live in /android-signing (gitignored): keystore.properties + the .jks it points to.
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// @generated withReleaseSigning';

const PROPERTIES_LOADER = `${MARKER}
def keystorePropertiesFile = new File(rootDir.getParentFile(), "android-signing/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

const RELEASE_SIGNING_CONFIG = `
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile new File(keystorePropertiesFile.getParentFile(), keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`;

const applySigning = (gradle) => {
  if (gradle.includes(MARKER)) {
    return gradle;
  }

  let next = gradle;
  if (!next.includes('import java.io.FileInputStream')) {
    next = `import java.io.FileInputStream\nimport java.util.Properties\n\n${next}`;
  }

  next = next.replace(/\nandroid \{/, `\n${PROPERTIES_LOADER}\nandroid {`);

  // Add a release signing config next to the generated debug one.
  next = next.replace(
    /(signingConfigs \{\s*\n\s*debug \{[\s\S]*?\n\s*\})/,
    `$1${RELEASE_SIGNING_CONFIG}`
  );

  // The release build type uses the upload key when credentials are present.
  next = next.replace(
    /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'
  );

  // Debug builds install side by side with the Play version.
  next = next.replace(
    /(buildTypes \{\s*\n\s*debug \{)/,
    '$1\n            applicationIdSuffix ".debug"\n            versionNameSuffix "-debug"'
  );

  return next;
};

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = applySigning(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.applySigning = applySigning;
