import { describe, expect, it } from 'vitest';
import { actorName, asksForPrice, canJumpToGot, statusChoices, currentStepTone, formatMoney, itemMeta, itemSteps, needsPrice, nextActionLabel, nextUpFor, parseLink, parsePrice, roomOptions, stageHint, stageNote } from './items';
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
  it('always shows all five steps, Installed marked optional when nothing needs installing', () => {
    const steps = itemSteps(item({ status: 'ordered', needsInstall: true }));
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(steps.every((s) => !s.optional)).toBe(true);
    const plain = itemSteps(item({ status: 'delivered' }));
    expect(plain.map((s) => s.status)).toEqual(['needed', 'looking', 'ordered', 'delivered', 'installed']);
    expect(plain.map((s) => s.optional)).toEqual([false, false, false, false, true]);
  });

  it('says honestly what is left under the stepper', () => {
    expect(stageNote(item({ status: 'ordered' }))).toBeUndefined();
    expect(stageNote(item({ status: 'delivered', needsInstall: true }))).toBe('Delivered. Still to install.');
    expect(stageNote(item({ status: 'delivered' }))).toMatch(/only if it needs fitting/);
    expect(stageNote(item({ status: 'installed' }))).toBe('Installed. All done.');
  });

  it('gives the sheet a secondary line instead of dotted suffixes', () => {
    expect(stageHint(item(), 'looking')).toBe('Next');
    expect(stageHint(item(), 'ordered')).toBeUndefined();
    expect(stageHint(item(), 'delivered')).toBe('You have it');
    expect(stageHint(item({ status: 'ordered' }), 'delivered')).toBe('Next · you have it');
    expect(stageHint(item(), 'installed')).toBe('Optional · only if it needs fitting');
    expect(stageHint(item({ status: 'delivered', needsInstall: true }), 'installed')).toBe('Next');
    expect(stageHint(item({ needsInstall: true }), 'installed')).toBeUndefined();
  });

  it('offers the explicit Got it jump only while the main button leads somewhere earlier', () => {
    expect(canJumpToGot(item())).toBe(true);
    expect(canJumpToGot(item({ status: 'looking' }))).toBe(true);
    expect(canJumpToGot(item({ status: 'ordered' }))).toBe(false);
    expect(canJumpToGot(item({ status: 'delivered' }))).toBe(false);
  });

  it('asks for a price on ordered and got rows that have none', () => {
    expect(needsPrice(item())).toBe(false);
    expect(needsPrice(item({ status: 'looking' }))).toBe(false);
    expect(needsPrice(item({ status: 'ordered' }))).toBe(true);
    expect(needsPrice(item({ status: 'delivered' }))).toBe(true);
    expect(needsPrice(item({ status: 'installed' }))).toBe(true);
    expect(needsPrice(item({ status: 'delivered', actualPrice: 0 }))).toBe(false);
  });

  it('Next up follows the person filter, and without one prefers mine or unclaimed', () => {
    const mine = item({ id: 'a', name: 'Lamp', assignedTo: 'nikita', addedAt: '2026-11-21T12:00:00Z' });
    const hers = item({ id: 'b', name: 'Rug', assignedTo: 'daryna', urgent: true, addedAt: '2026-11-21T09:00:00Z' });
    const free = item({ id: 'c', name: 'Mop', addedAt: '2026-11-21T11:00:00Z' });
    expect(nextUpFor([mine, hers, free], 'daryna', 'nikita')?.id).toBe('b');
    expect(nextUpFor([mine, hers, free], 'nikita', 'nikita')?.id).toBe('a');
    expect(nextUpFor([mine, hers, free], null, 'nikita')?.id).toBe('c');
    expect(nextUpFor([hers], null, 'nikita')?.id).toBe('b');
    expect(nextUpFor([mine, free], 'daryna', 'nikita')).toBeUndefined();
  });

  it('uses amber only for an ordered current step, mint once finished, neutral otherwise', () => {
    expect(currentStepTone(item())).toBe('neutral');
    expect(currentStepTone(item({ status: 'looking' }))).toBe('neutral');
    expect(currentStepTone(item({ status: 'ordered' }))).toBe('transit');
    expect(currentStepTone(item({ status: 'delivered' }))).toBe('done');
    expect(currentStepTone(item({ status: 'delivered', needsInstall: true }))).toBe('neutral');
    expect(currentStepTone(item({ status: 'installed', needsInstall: true }))).toBe('done');
  });

  it('names the one next stage in plain words and never jumps to the end', () => {
    expect(nextActionLabel(item())).toBe('Mark looking');
    expect(nextActionLabel(item({ status: 'looking' }))).toBe('Mark ordered');
    expect(nextActionLabel(item({ status: 'ordered' }))).toBe('Got it');
    expect(nextActionLabel(item({ status: 'ordered', needsInstall: true }))).toBe('Got it');
    expect(nextActionLabel(item({ status: 'delivered', needsInstall: true }))).toBe('Mark installed');
    expect(nextActionLabel(item({ status: 'delivered' }))).toBeUndefined();
    expect(nextActionLabel(item({ status: 'installed', needsInstall: true }))).toBeUndefined();
  });

  it('offers every stage in the status sheet, Installed included even when nothing needs installing', () => {
    expect(statusChoices(item({ status: 'delivered' }))).toEqual(['needed', 'looking', 'ordered', 'delivered', 'installed']);
    expect(statusChoices(item({ status: 'needed', needsInstall: true }))).toEqual(['needed', 'looking', 'ordered', 'delivered', 'installed']);
    // An item already installed keeps that stage so it can be seen and moved back from.
    expect(statusChoices(item({ status: 'installed' }))).toEqual(['needed', 'looking', 'ordered', 'delivered', 'installed']);
  });

  it('asks "Paid?" when an item has just been ordered or has just arrived and has no paid price', () => {
    expect(asksForPrice(item({ status: 'looking' }), item({ status: 'ordered' }))).toBe(true);
    expect(asksForPrice(item({ status: 'needed' }), item({ status: 'ordered' }))).toBe(true);
    expect(asksForPrice(item({ status: 'looking' }), item({ status: 'ordered', actualPrice: 9 }))).toBe(false);
    expect(asksForPrice(item({ status: 'delivered' }), item({ status: 'ordered' }))).toBe(false);
    expect(asksForPrice(item({ status: 'ordered' }), item({ status: 'delivered' }))).toBe(true);
    expect(asksForPrice(item({ status: 'needed' }), item({ status: 'installed' }))).toBe(true);
    expect(asksForPrice(item({ status: 'ordered' }), item({ status: 'delivered', actualPrice: 25 }))).toBe(false);
    expect(asksForPrice(item({ status: 'delivered' }), item({ status: 'installed' }))).toBe(false);
    expect(asksForPrice(item({ status: 'delivered' }), item({ status: 'ordered' }))).toBe(false);
    expect(asksForPrice(item({ status: 'needed' }), item({ status: 'looking' }))).toBe(false);
  });

  it('formats money and the meta line, leaving out what is missing', () => {
    expect(formatMoney(90)).toBe('£90');
    expect(formatMoney(84.99)).toBe('£84.99');
    expect(formatMoney(84.5)).toBe('£84.50');
    expect(itemMeta(item({ room: 'Kitchen', estPrice: 90 }))).toBe('Kitchen · 1 item · £90 est.');
    expect(itemMeta(item({ quantity: 3 }))).toBe('3 items');
    expect(itemMeta(item({ room: 'Kitchen', estPrice: 90, actualPrice: 84.99 }))).toBe('Kitchen · 1 item · £84.99 paid');
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
