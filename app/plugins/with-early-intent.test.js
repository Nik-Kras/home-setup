import { describe, expect, it } from 'vitest';
import plugin from './with-early-intent.js';

const { addEarlyIntent } = plugin;

const MAIN_ACTIVITY = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

describe('with-early-intent', () => {
  it('keeps a new intent the React delegate dropped as the Activity intent, right after super.onCreate', () => {
    const out = addEarlyIntent(MAIN_ACTIVITY);
    expect(out).toContain('    super.onCreate(null)\n    // home-setup:');
    expect(out).toContain('    addOnNewIntentListener { setIntent(it) }\n  }');
  });

  it('adds it once', () => {
    const once = addEarlyIntent(MAIN_ACTIVITY);
    expect(addEarlyIntent(once)).toBe(once);
    expect(once.match(/addOnNewIntentListener/g)).toHaveLength(1);
  });

  it('fails loudly when the template changes', () => {
    expect(() => addEarlyIntent('class MainActivity : ReactActivity() {}')).toThrow(/update the plugin/);
  });
});
