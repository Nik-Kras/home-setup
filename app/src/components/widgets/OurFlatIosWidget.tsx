'use no memo';

import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement, accessibilityLabel, background, buttonStyle, clipShape, containerBackground, font,
  foregroundStyle, frame, lineLimit, padding, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { IosWidgetProps } from '../../data/iosWidget';

/**
 * The iPhone home-screen widget, small, medium and large. It runs in the widget extension's own JS
 * runtime: only names from @expo/ui/swift-ui and its modifiers exist there, so every constant and
 * helper lives inside the function and imports are used under their own names. The name and initial
 * props are literals because the build-time layout registry bundles this file without its relative
 * imports' dependencies (they match IOS_WIDGET_NAME and SIGNED_OUT_PROPS in data/iosWidget.ts).
 */
const OurFlatIosWidget = (props: IosWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const c = {
    surface: '#171B19', neutralFill: '#262B28', text: '#F2F4F1', textSecondary: '#AEB8B2',
    mint: '#5EE0B8', mintFill: '#223A32', onMint: '#06241B', coral: '#FF8A5B',
    amber: '#FFC457', amberFill: '#3C3623', ring: '#787B7A',
  };
  // SF Symbols for the item glyphs (domain/glyphs.ts draws the same names as SVG on Android).
  const symbols = {
    kettle: 'cup.and.saucer', microwave: 'microwave', toaster: 'square.split.2x1', wifi: 'wifi', curtain: 'curtains.closed',
    shelf: 'books.vertical', lamp: 'lamp.floor', sofa: 'sofa', box: 'shippingbox',
  } as const;
  const got = new Set((props.got ?? []).map((tap) => tap.id));
  const left = props.leftCount ?? 0;
  const statusOf = (row: { id: string; status: string }) => (got.has(row.id) ? 'Delivered' : row.status);
  const itemUrl = (id: string) => 'homesetup://item/' + encodeURIComponent(id);
  const serif = (size: number) => font({ design: 'serif', size });
  const sans = (size: number, weight: 'regular' | 'semibold' = 'regular') => font({ size, weight });
  const frameStyle = [containerBackground(c.surface, 'widget'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })];

  const Plus = ({ size }: { size: number }) => (
    <Image systemName="plus" size={size * 0.45} color={c.onMint}
      modifiers={[frame({ width: size, height: size }), background(c.mint), clipShape('circle')]} />
  );

  const Chip = ({ status }: { status: string }) => {
    const ordered = status === 'Ordered';
    const done = status === 'Delivered' || status === 'Installed';
    return (
      <Text modifiers={[
        sans(13, 'semibold'), lineLimit(1), foregroundStyle(ordered ? c.amber : done ? c.mint : c.textSecondary),
        padding({ horizontal: 8, vertical: 3 }), background(ordered ? c.amberFill : done ? c.mintFill : c.neutralFill), clipShape('capsule'),
      ]}>{status}</Text>
    );
  };

  const Name = ({ name, urgent }: { name: string; urgent: boolean }) => (
    <HStack spacing={4}>
      {urgent ? <Text modifiers={[sans(15, 'semibold'), foregroundStyle(c.coral)]}>!</Text> : null}
      <Text modifiers={[sans(15, 'semibold'), foregroundStyle(c.text), lineLimit(1)]}>{name}</Text>
    </HStack>
  );

  const Header = ({ plus }: { plus: number }) => (
    <HStack spacing={6} alignment="center">
      <Text modifiers={[serif(25), foregroundStyle(c.text), lineLimit(1)]}>Our flat</Text>
      <Text modifiers={[sans(13), foregroundStyle(c.textSecondary), lineLimit(1)]}>{left + ' left'}</Text>
      <Spacer />
      <Link destination="homesetup://add-item" modifiers={[accessibilityLabel('Add an item')]}>
        <Plus size={plus} />
      </Link>
    </HStack>
  );

  if (!props.signedIn) {
    return (
      <VStack spacing={6} modifiers={[containerBackground(c.surface, 'widget'), accessibilityElement('combine')]}>
        <Text modifiers={[serif(25), foregroundStyle(c.text)]}>Our flat</Text>
        <Text modifiers={[sans(13), foregroundStyle(c.textSecondary), lineLimit(2)]}>Open the app to sign in</Text>
      </VStack>
    );
  }

  // Small widgets have one tap target, so the whole widget is the add button.
  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={[...frameStyle, padding({ all: 16 }), widgetURL('homesetup://add-item'),
        accessibilityElement('combine'), accessibilityLabel('Our flat. ' + left + ' to get. Add an item')]}>
        <Text modifiers={[sans(14), foregroundStyle(c.textSecondary)]}>Our flat</Text>
        <Spacer />
        <HStack alignment="bottom">
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[serif(56), foregroundStyle(c.text), lineLimit(1)]}>{String(left)}</Text>
            <Text modifiers={[sans(13, 'semibold'), foregroundStyle(c.textSecondary)]}>to get</Text>
          </VStack>
          <Spacer />
          <Plus size={44} />
        </HStack>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[...frameStyle, padding({ horizontal: 16, vertical: 10 })]}>
        <Header plus={34} />
        {props.top.slice(0, 3).map((row) => (
          <Link key={row.id} destination={itemUrl(row.id)}
            modifiers={[accessibilityLabel(row.name + ', ' + statusOf(row) + (row.urgent ? ', urgent' : '') + '. Open item details')]}>
            <HStack spacing={8} modifiers={[frame({ height: 30 })]}>
              <Image systemName={symbols[row.icon as keyof typeof symbols] ?? 'shippingbox'} size={15} color={c.textSecondary}
                modifiers={[frame({ width: 28, height: 28 }), background(c.neutralFill), clipShape('roundedRectangle', 9)]} />
              <Name name={row.name} urgent={row.urgent} />
              <Spacer />
              <Chip status={statusOf(row)} />
            </HStack>
          </Link>
        ))}
        {props.top.length === 0 ? <Text modifiers={[sans(13), foregroundStyle(c.textSecondary)]}>Everything is got</Text> : null}
        <Spacer />
      </VStack>
    );
  }

  // Large: rooms and up to 4 rows, each with a "got it" check that works without opening the app.
  return (
    <VStack alignment="leading" spacing={0} modifiers={[...frameStyle, padding({ horizontal: 16, vertical: 12 })]}>
      <Header plus={40} />
      {props.rooms.map(({ room, items }) => (
        <VStack key={room} alignment="leading" spacing={0}>
          <Text modifiers={[serif(17), foregroundStyle(c.textSecondary), lineLimit(1), padding({ top: 6 })]}>{room}</Text>
          {items.map((row) => {
            const status = statusOf(row);
            const isGot = status === 'Delivered' || status === 'Installed';
            return (
              <HStack key={row.id} spacing={4} modifiers={[frame({ height: 40 })]}>
                {isGot ? (
                  <Image systemName="checkmark.circle" size={24} color={c.mint} modifiers={[frame({ width: 40, height: 40 })]} />
                ) : (
                  <Button target={'got:' + row.id} modifiers={[buttonStyle('plain'), accessibilityLabel('Mark ' + row.name + ' as got')]}
                    onPress={() => ({
                      got: [...(props.got ?? []), { id: row.id, from: row.from, at: new Date().toISOString() }],
                      leftCount: row.install ? left : Math.max(0, left - 1),
                    })}>
                    <Image systemName="circle" size={24} color={c.ring} modifiers={[frame({ width: 40, height: 40 })]} />
                  </Button>
                )}
                <Link destination={itemUrl(row.id)}
                  modifiers={[accessibilityLabel(row.name + ', ' + status + (row.urgent ? ', urgent' : '') + '. Open item details')]}>
                  <HStack spacing={8}>
                    <Name name={row.name} urgent={row.urgent} />
                    <Spacer />
                    <Chip status={status} />
                  </HStack>
                </Link>
              </HStack>
            );
          })}
        </VStack>
      ))}
      {props.rooms.length === 0 ? <Text modifiers={[sans(13), foregroundStyle(c.textSecondary), padding({ top: 8 })]}>Everything is got</Text> : null}
      <Spacer />
    </VStack>
  );
};

export default createWidget<IosWidgetProps>('OurFlat', OurFlatIosWidget, { signedIn: false, leftCount: 0, top: [], rooms: [], got: [] });
