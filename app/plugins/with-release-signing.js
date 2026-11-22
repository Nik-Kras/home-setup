// Config plugin: signs the Android release build with the key described in a properties file outside the
// repo, read by Gradle at build time (no password is written into android/). Falls back to the debug key
// when the file is absent, so a build on another machine still works.
//
// File: $HOME_SETUP_SIGNING_PROPERTIES, or ~/.android-keys/home-setup-release.properties, with
//   storeFile=/absolute/path/or/relative/to/the/properties/file.jks
//   storePassword=...
//   keyAlias=...
//   keyPassword=...
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// home-setup release signing (plugins/with-release-signing.js)';

const LOAD = `${MARKER}
def homeSetupSigningFile = file(System.getenv('HOME_SETUP_SIGNING_PROPERTIES') ?: "\${System.getProperty('user.home')}/.android-keys/home-setup-release.properties")
def homeSetupSigning = new Properties()
if (homeSetupSigningFile.exists()) {
    homeSetupSigningFile.withInputStream { homeSetupSigning.load(it) }
    logger.lifecycle("Release signing: key from \${homeSetupSigningFile}")
} else {
    logger.lifecycle("Release signing: \${homeSetupSigningFile} not found, release uses the debug key")
}
def homeSetupStoreFile = { ->
    def f = new File(homeSetupSigning['storeFile'])
    return f.isAbsolute() ? f : new File(homeSetupSigningFile.parentFile, f.path)
}

android {`;

const RELEASE_CONFIG = `signingConfigs {
        if (homeSetupSigningFile.exists()) {
            release {
                storeFile homeSetupStoreFile()
                storePassword homeSetupSigning['storePassword']
                keyAlias homeSetupSigning['keyAlias']
                keyPassword homeSetupSigning['keyPassword']
            }
        }`;

function applySigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const steps = [
    [/^android \{/m, LOAD],
    [/signingConfigs \{/, RELEASE_CONFIG],
    // The release build type's signingConfig line (the template points it at the debug key).
    [
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig homeSetupSigningFile.exists() ? signingConfigs.release : signingConfigs.debug',
    ],
  ];
  for (const [pattern, replacement] of steps) {
    if (!pattern.test(gradle)) {
      throw new Error(`with-release-signing: app/build.gradle no longer matches ${pattern}; update the plugin`);
    }
    gradle = gradle.replace(pattern, replacement);
  }
  return gradle;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-release-signing: expected a Groovy app/build.gradle');
    }
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
