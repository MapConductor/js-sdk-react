import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { Offset } from '@mapconductor/js-sdk-core';

interface InfoBubbleOverlayProps {
  positionOffset: Offset;
  iconSize: { width: number; height: number };
  iconOffset: Offset;
  infoAnchorOffset: Offset;
  tailOffset: Offset;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function InfoBubbleOverlay({
  positionOffset,
  iconSize,
  iconOffset,
  infoAnchorOffset,
  tailOffset,
  children,
  style,
}: InfoBubbleOverlayProps) {
  const [infoWndSize, setInfoWndSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setInfoWndSize((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  };

  const x =
    positionOffset.x +
    -tailOffset.x * infoWndSize.width +
    (0.5 - iconOffset.x) * iconSize.width +
    (infoAnchorOffset.x - 0.5) * iconSize.width;

  const y =
    positionOffset.y +
    -tailOffset.y * infoWndSize.height +
    (0.5 - iconOffset.y) * iconSize.height +
    (infoAnchorOffset.y - 0.5) * iconSize.height;

  return (
    <View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[{ position: 'absolute', left: x, top: y }, style]}
    >
      {children}
    </View>
  );
}
