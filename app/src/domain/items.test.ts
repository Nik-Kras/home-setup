import { describe, expect, it } from 'vitest';
import { actorName, clearedDatesWarning, currentStepTone, formatMoney, itemMeta, itemSteps, nextActionLabel, parseLink, parsePrice, roomOptions, skippedStatuses } from './items';
import type { Item } from './types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  name: 'Kettle',
  status: 'needed',
  quantity: 1,
  urgent: false,
  needsInstall: false,
  addedAt: '2026-11-21T10:00:00Z',
  updatedBy: 'nikita',
  ...over,
});

describe('item detail helpers', () => {
  it('skips installed only for items that need no installing and are not already installed', () => {
    expect(skippedStatuses(item())).toEqual(['installed']);
    expect(skippedStatuses(item({ needsInstall: true }))).toEqual([]);
    expect(skippedStatuses(item({ status: 'installed' }))).toEqual([]);
  });

  it('marks steps as done, current and pending', () => {
    const steps = itemSteps(item({ status: 'ordered', needsInstall: true }));
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(itemSteps(item({ status: 'delivered' })).map((s) => s.status)).toEqual(['needed', 'looking', 'ordered', 'delivered']);
  });

  it('uses amber only for an ordered current step, mint once finished, neutral otherwise', () => {
    expect(currentStepTone(item())).toBe('neutral');
    expect(currentStepTone(item({ status: 'looking' }))).toBe('neutral');
    expect(currentStepTone(item({ status: 'ordered' }))).toBe('transit');
    expect(currentStepTone(item({ status: 'delivered' }))).toBe('done');
    expect(currentStepTone(item({ status: 'delivered', needsInstall: true }))).toBe('neutral');
    expect(currentStepTone(item({ status: 'installed', needsInstall: true }))).toBe('done');
  });

  it('asks for confirmation only when a stepper tap would clear a date', () => {
    const delivered = item({ status: 'delivered', needsInstall: true, deliveredAt: '2026-11-22T09:00:00Z' });
    expect(clearedDatesWarning(delivered, 'ordered')).toBe('This clears the delivered date.');
    expect(clearedDatesWarning(delivered, 'installed')).toBeUndefined();
    const installed = { ...delivered, status: 'installed' as const, installedAt: '2026-11-23T09:00:00Z' };
    expect(clearedDatesWarning(installed, 'delivered')).toBe('This clears the installed date.');
    expect(clearedDatesWarning(installed, 'needed')).toBe('This clears the delivered and installed dates.');
    expect(clearedDatesWarning(item({ status: 'ordered' }), 'needed')).toBeUndefined();
    expect(clearedDatesWarning(delivered, 'delivered')).toBeUndefined();
  });

  it('names the next action and hides it once finished', () => {
    expect(nextActionLabel(item())).toBe('Start looking');
    expect(nextActionLabel(item({ status: 'looking' }))).toBe('Mark as ordered');
    expect(nextActionLabel(item({ status: 'ordered' }))).toBe('Mark as delivered');
    expect(nextActionLabel(item({ status: 'delivered', needsInstall: true }))).toBe('Mark as installed');
    expect(nextActionLabel(item({ status: 'delivered' }))).toBeUndefined();
    expect(nextActionLabel(item({ status: 'installed', needsInstall: true }))).toBeUndefined();
  });

  it('formats money and the meta line, leaving out what is missing', () => {
    expect(formatMoney(90)).toBe('£90');
    expect(formatMoney(84.99)).toBe('£84.99');
    expect(formatMoney(84.5)).toBe('£84.50');
    expect(itemMeta(item({ room: 'Kitchen', estPrice: 90 }))).toBe('Kitchen · 1 item · £90 est.');
    expect(itemMeta(item({ quantity: 3 }))).toBe('3 items');
  });

  it('parses a typed price', () => {
    expect(parsePrice('84.99')).toBe(84.99);
    expect(parsePrice(' £84,99 ')).toBe(84.99);
    expect(parsePrice('12.345')).toBe(12.35);
    expect(parsePrice('.5')).toBe(0.5);
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('-3')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('1.2.3')).toBeNull();
    expect(parsePrice('100000000')).toBeNull();
  });

  it('reads a comma before exactly three digits as thousands, any other comma as the decimal point', () => {
    expect(parsePrice('1,200')).toBe(1200);
    expect(parsePrice('12,345.50')).toBe(12345.5);
    expect(parsePrice('1,234,567')).toBe(1234567);
    expect(parsePrice('1,20')).toBe(1.2);
    expect(parsePrice('12,5')).toBe(12.5);
    expect(parsePrice('12.50')).toBe(12.5);
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('-5')).toBeNull();
    expect(parsePrice('1,2,3')).toBeNull();
    expect(parsePrice('1,20.5')).toBeNull();
  });

  it('parses a product link and refuses other schemes', () => {
    expect(parseLink('example.com/p/1')).toBe('https://example.com/p/1');
    expect(parseLink('http://shop.example.co.uk')).toBe('http://shop.example.co.uk');
    expect(parseLink('')).toBeUndefined();
    expect(parseLink('javascript:alert(1)')).toBeNull();
    expect(parseLink('intent://x')).toBeNull();
    expect(parseLink('not a link')).toBeNull();
    expect(parseLink('localhost')).toBeNull();
  });

  it('lists the loaded rooms, plus the item room if it is not among them', () => {
    expect(roomOptions(['Kitchen', 'Hallway'], 'Kitchen')).toEqual(['Kitchen', 'Hallway']);
    expect(roomOptions(['Kitchen', 'Hallway'], 'Study')).toEqual(['Kitchen', 'Hallway', 'Study']);
    expect(roomOptions(['Kitchen'])).toEqual(['Kitchen']);
  });

  it('names actors', () => {
    expect(actorName('claude')).toBe('Claude');
    expect(actorName('daryna')).toBe('Daryna');
  });
});
