'use no memo';

import type { ReactNode } from 'react';
import { FlexWidget, SvgWidget, TextWidget, type FlexWidgetStyle, type TextWidgetProps, type WidgetInfo } from 'react-native-android-widget';
import { ICON_PATHS, type IconName } from '../../domain/glyphs';
import { fitRooms, type WidgetView } from '../../domain/widgetData';
import { colors, fonts, radius, TARGET } from '../../theme/tokens';

export const WIDGET_NAMES = ['OurFlatSmall', 'OurFlatMedium', 'OurFlatLarge'] as const;
export const MARK_GOT = 'MARK_GOT';

type Row = WidgetView['rooms'][number]['items'][number];

const fill = { width: 'match_parent', height: 'match_parent' } as const;
const horizontal = { flexDirection: 'row', alignItems: 'center' } as const;
const center = { alignItems: 'center', justifyContent: 'center' } as const;
const frame = {
  ...fill, backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1,
  borderRadius: radius.card, paddingHorizontal: 12, paddingVertical: 5,
} satisfies FlexWidgetStyle;

function Label({ style, ...props }: TextWidgetProps) {
  return <TextWidget maxLines={1} truncate="END" {...props} style={{
    fontSize: 13, color: colors.text, fontFamily: fonts.regular, ...style,
  }} />;
}

function Glyph({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return <SvgWidget style={{ width: size, height: size }} svg={
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ICON_PATHS[name]}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  } />;
}

function AddButton() {
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'homesetup://add-item' }} accessibilityLabel="Add an item"
      style={{ ...center, width: TARGET, height: TARGET, borderRadius: TARGET / 2, backgroundColor: colors.mint }}>
      <Glyph name="plus" color={colors.onMint} size={24} />
    </FlexWidget>
  );
}

function Header({ left }: { left: number }) {
  return (
    <FlexWidget style={{ ...horizontal, width: 'match_parent', height: 'wrap_content' }}>
      <FlexWidget style={{ ...horizontal, flex: 1, width: 0, flexGap: 4 }}>
        <Label text="Our flat" style={{ fontFamily: fonts.serif, fontSize: 25 }} />
        <Label text={`· ${left} left`} style={{ color: colors.textSecondary }} />
      </FlexWidget>
      <AddButton />
    </FlexWidget>
  );
}

function Status({ status }: { status: Row['status'] }) {
  const ordered = status === 'Ordered';
  const got = status === 'Delivered' || status === 'Installed';
  return (
    <FlexWidget style={{
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14,
      backgroundColor: ordered ? colors.amberFill : got ? colors.mintFill : colors.neutralFill,
    }}>
      <Label text={status} style={{ fontFamily: fonts.semibold, color: ordered ? colors.amber : got ? colors.mint : colors.textSecondary }} />
    </FlexWidget>
  );
}

function GotButton({ row, height }: { row: Row; height: number }) {
  const delivered = row.status === 'Delivered';
  return (
    <FlexWidget clickAction={delivered ? undefined : MARK_GOT} clickActionData={{ id: row.id }}
      accessibilityLabel={delivered ? undefined : `Mark ${row.name} as got`}
      style={{ ...center, width: TARGET, height }}>
      <FlexWidget style={{
        ...center, width: 24, height: 24, borderRadius: 12, borderWidth: 2,
        borderColor: delivered ? colors.mint : colors.hairlineStrong,
      }}>
        {delivered && <Glyph name="check" color={colors.mint} size={16} />}
      </FlexWidget>
    </FlexWidget>
  );
}

function ItemRow({ row, icon, height }: { row: Row; icon?: IconName; height: number }) {
  const tile = Math.min(height - 4, 36);
  return (
    <FlexWidget style={{ ...horizontal, width: 'match_parent', height }}>
      {!icon && <GotButton row={row} height={height} />}
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `homesetup://item/${encodeURIComponent(row.id)}` }}
        accessibilityLabel={`${row.name}, ${row.status}${row.urgent ? ', urgent' : ''}. Open item details`}
        style={{ ...horizontal, flex: 1, width: 0, height: 'match_parent', flexGap: 7 }}>
        {icon && (
          <FlexWidget style={{ ...center, width: tile, height: tile, borderRadius: radius.tile, backgroundColor: colors.neutralFill }}>
            <Glyph name={icon} color={colors.textSecondary} />
          </FlexWidget>
        )}
        <FlexWidget style={{ ...horizontal, flex: 1, width: 0, flexGap: 4 }}>
          {row.urgent && <Label text="!" style={{ color: colors.coral, fontFamily: fonts.semibold }} />}
          <Label text={row.name} style={{ fontFamily: fonts.semibold, fontSize: 15 }} />
        </FlexWidget>
        <Status status={row.status} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Frame({ children, label, style }: { children: ReactNode; label: string; style?: FlexWidgetStyle }) {
  return (
    <FlexWidget clickAction="OPEN_APP" accessibilityLabel={label} style={{ ...frame, ...style }}>
      {children}
    </FlexWidget>
  );
}

/** Frame padding and border, and the height budgeted for a room label and a 13sp line (text wraps, so these are estimates). */
const FRAME_INSET = 12;
const ROOM_LINE = 28;
const SMALL_LINE = 20;

function updatedLabel(updatedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  if (minutes < 1440) return `Updated ${Math.floor(minutes / 60)}h ago`;
  return `Updated ${Math.floor(minutes / 1440)}d ago`;
}

export function renderOurFlatWidget(info: WidgetInfo, data: WidgetView | null) {
  if (!data) {
    return (
      <Frame label="Our flat. Open the app to sign in" style={{ ...center, flexGap: 6 }}>
        <Label text="Our flat" style={{ fontFamily: fonts.serif, fontSize: 25 }} />
        <Label text="Open the app to sign in" maxLines={2} style={{ textAlign: 'center', color: colors.textSecondary }} />
      </Frame>
    );
  }

  if (info.widgetName === 'OurFlatSmall') {
    return (
      <Frame label={`Our flat. ${data.leftCount} to get`} style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
        <Label text="Our flat" style={{ color: colors.textSecondary, fontSize: 14 }} />
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-end' }}>
          <FlexWidget style={{ flex: 1, width: 0 }}>
            <Label text={String(data.leftCount)} style={{ fontFamily: fonts.serif, fontSize: 56 }} />
            <Label text="to get" style={{ color: colors.textSecondary, fontFamily: fonts.semibold }} />
          </FlexWidget>
          <AddButton />
        </FlexWidget>
      </Frame>
    );
  }

  const label = `Our flat. ${data.leftCount} left`;
  if (info.widgetName === 'OurFlatMedium') {
    // Rows stay 44dp; a short widget shows fewer of them.
    const fit = Math.max(0, Math.floor((info.height - TARGET - FRAME_INSET) / TARGET));
    return (
      <Frame label={label}>
        <Header left={data.leftCount} />
        {data.top.slice(0, fit).map((row) => <ItemRow key={row.id} row={row} icon={row.icon} height={TARGET} />)}
        {data.top.length === 0 && <Label text="Everything is got" style={{ color: colors.textSecondary }} />}
      </Frame>
    );
  }

  // Keep the check and row actions at 44dp on smaller launchers by showing fewer rows when needed,
  // dropping by priority (urgent rows stay longest), and say how many are not shown.
  const { rooms, more } = fitRooms(data, info.height - TARGET - FRAME_INSET - SMALL_LINE, { room: ROOM_LINE, row: TARGET, more: SMALL_LINE });
  const sections = rooms.flatMap(({ room, items }) => [
    <FlexWidget key={room} style={{ width: 'match_parent', height: 'wrap_content', paddingTop: 4 }}>
      <Label text={room} style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.textSecondary }} />
    </FlexWidget>,
    ...items.map((row) => <ItemRow key={row.id} row={row} height={TARGET} />),
  ]);

  return (
    <Frame label={label}>
      <Header left={data.leftCount} />
      {sections}
      {more > 0 && <Label text={`+${more} more`} style={{ color: colors.textSecondary }} />}
      {data.rooms.length === 0 && <Label text="Everything is got" style={{ color: colors.textSecondary }} />}
      <FlexWidget style={{ flex: 1, height: 0 }} />
      <Label text={updatedLabel(data.updatedAt, Date.now())} style={{ color: colors.textMuted }} />
    </Frame>
  );
}
