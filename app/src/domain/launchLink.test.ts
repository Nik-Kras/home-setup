import { describe, expect, it } from 'vitest';
import { launchPath } from './launchLink';

describe('launchPath', () => {
  it('uses the launch URL when the router fell back to the root', () => {
    expect(launchPath('homesetup:///', 'homesetup://add-item')).toBe('homesetup://add-item');
    expect(launchPath('/', 'homesetup://item/abc-1')).toBe('homesetup://item/abc-1');
    expect(launchPath('', 'homesetup://item/abc-1')).toBe('homesetup://item/abc-1');
  });

  it('keeps the path the router already has', () => {
    expect(launchPath('homesetup://item/abc-1', 'homesetup://add-item')).toBe('homesetup://item/abc-1');
    expect(launchPath('/notes', null)).toBe('/notes');
  });

  it('keeps the root for a plain launch or a foreign or root URL', () => {
    expect(launchPath('homesetup:///', null)).toBe('homesetup:///');
    expect(launchPath('homesetup:///', 'homesetup://')).toBe('homesetup:///');
    expect(launchPath('homesetup:///', 'https://example.com/item/1')).toBe('homesetup:///');
  });
});
