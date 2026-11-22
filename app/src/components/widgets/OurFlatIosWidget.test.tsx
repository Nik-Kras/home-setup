import { describe, expect, it, vi } from 'vitest';
import { pendingGot, settleGot, toIosWidgetProps, type IosWidgetProps } from '../../data/iosWidget';
import { makeWidgetSnapshot } from '../../data/widgetSnapshot';
import type { Item, Person } from '../../domain/types';

// The widget runs in the extension's own runtime; here the Expo UI names are plain markers and
// createWidget hands back the layout function, so its output and button presses can be read in Node.
vi.mock('@expo/ui/swift-ui', () => Object.fromEntries(
  ['Button', 'HStack', 'Image', 'Link', 'Spacer', 'Text', 'VStack'].map((name) => [name, name]),
));
vi.mock('@expo/ui/swift-ui/modifiers', () => Object.fromEntries(
  ['accessibilityElement', 'accessibilityLabel', 'background', 'buttonStyle', 'clipShape', 'containerBackground', 'font',
    'foregroundStyle', 'frame', 'lineLimit', 'padding', 'widgetURL'].map((name) => [name, (...args: unknown[]) => ({ name, args })]),
));
vi.mock('expo-widgets', () => ({ createWidget: (_name: string, layout: unknown) => layout }));

const { default: layout } = await import('./OurFlatIosWidget') as unknown as {
  default: (props: IosWidgetProps, environment: { widgetFamily?: string }) => Node;
};

interface Node { type: unknown; props: Record<string, unknown> & { children?: unknown } }

/** Render function components and flatten children, as the widget runtime does. */
function resolve(node: unknown): unknown {
  let current = node as Node | null;
  while (current && typeof current.type === 'function') current = (current.type as (p: unknown) => Node)(current.props);
  if (Array.isArray(current)) return current.flat(Infinity).map(resolve);
  if (current && typeof current === 'object' && 'props' in current) {
    return { type: current.type, props: { ...current.props, children: resolve(current.props.children) } };
  }
  return current;
}

function find(node: unknown, type: string, out: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((child) => find(child, type, out));
  else if (node && typeof node === 'object' && 'props' in node) {
    if ((node as Node).type === type) out.push(node as Node);
    find((node as Node).props.children, type, out);
  }
  return out;
}

const me = 'member' as Person;
const time = new Date('2026-11-22T09:00:00Z');
const items: Item[] = [
  { id: 'item-1', name: 'Lamp', status: 'ordered', quantity: 1, room: 'Living room', urgent: true, needsInstall: false, addedAt: time.toISOString(), updatedBy: me },
  { id: 'item-2', name: 'Shelf', status: 'needed', quantity: 1, room: 'Bedroom', urgent: false, needsInstall: true, addedAt: time.toISOString(), updatedBy: me },
];
const props = toIosWidgetProps(makeWidgetSnapshot(items, time));
const render = (p: IosWidgetProps, widgetFamily: string) => resolve(layout(p, { widgetFamily }));
const text = (node: unknown) => JSON.stringify(node);

describe('iPhone widget layout', () => {
  it('draws each size with its links', () => {
    expect(text(render(props, 'systemSmall'))).toContain('homesetup://add-item');
    const medium = render(props, 'systemMedium');
    expect(find(medium, 'Link').map((link) => link.props.destination)).toEqual(['homesetup://add-item', 'homesetup://item/item-1', 'homesetup://item/item-2']);
    expect(find(medium, 'Button')).toEqual([]);
    expect(text(render({ ...props, signedIn: false }, 'systemLarge'))).toContain('Open the app to sign in');
    expect(text(render({ ...props, more: 2 }, 'systemLarge'))).toContain('+2 more');
  });

  it('a got press writes a tap the app can queue and shows the row as got', () => {
    const large = render(props, 'systemLarge');
    const buttons = find(large, 'Button');
    expect(buttons.map((b) => b.props.target)).toEqual(['got:item-1', 'got:item-2']);

    const before = Date.now();
    const update = (buttons[0].props.onPress as () => Partial<IosWidgetProps>)();
    const after = { ...props, ...update }; // the App Intent merges the returned props
    const taps = pendingGot([{ props: after }]);
    expect(taps).toMatchObject([{ id: 'item-1', from: 'ordered' }]);
    expect(Date.parse(taps[0].at)).toBeGreaterThanOrEqual(before - 1000);
    expect(after.leftCount).toBe(props.leftCount - 1);
    expect(find(render(after, 'systemLarge'), 'Button').map((b) => b.props.target)).toEqual(['got:item-2']);

    // Needs installing: stays on the list, so the count stays.
    const install = (buttons[1].props.onPress as () => Partial<IosWidgetProps>)();
    expect(install.leftCount).toBe(props.leftCount);

    // After the app takes the tap, the row still shows as got and cannot be tapped again.
    const settled = settleGot(after, taps);
    expect(find(render(settled, 'systemLarge'), 'Button').map((b) => b.props.target)).toEqual(['got:item-2']);
    expect(text(render(settled, 'systemMedium'))).toContain('Delivered');
  });
});
