// Config plugin: keeps a link that reaches MainActivity before the app has loaded.
//
// expo-updates delays loading the app until it has picked the bundle (EX_UPDATES_ANDROID_DELAY_LOAD_APP).
// Until then expo's ReactActivityDelegateWrapper.onNewIntent drops every new intent: neither React
// Native nor expo-linking sees it, and ReactActivity passes it on to Activity.onNewIntent instead.
// That happens when the widget's background task has started the app and the widget's "+" or a row is
// tapped next: Android recreates the Activity with its old launcher intent and hands the link over as
// a new intent at once, so the app opened the Buy list instead of the add screen or the item.
// Making the dropped intent the Activity's intent lets React Native's Linking.getInitialURL() (which
// reads the Activity's intent when the app loads) return the link. Intents the app does handle never
// reach this listener, as ReactActivity only calls super.onNewIntent when the delegate declined.
const { withMainActivity } = require('expo/config-plugins');

const MARKER = '// home-setup: a link that arrives before the app loads (plugins/with-early-intent.js)';
const LINE = `    ${MARKER}\n    addOnNewIntentListener { setIntent(it) }\n`;

function addEarlyIntent(source) {
  if (source.includes(MARKER)) return source;
  const pattern = /^([ \t]*super\.onCreate\([^)]*\)\s*\n)/m;
  if (!pattern.test(source)) {
    throw new Error('with-early-intent: MainActivity.onCreate no longer calls super.onCreate(...); update the plugin');
  }
  return source.replace(pattern, `$1${LINE}`);
}

module.exports = function withEarlyIntent(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('with-early-intent: expected a Kotlin MainActivity');
    }
    cfg.modResults.contents = addEarlyIntent(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.addEarlyIntent = addEarlyIntent;
