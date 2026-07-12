import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface DrawInfoBubbleProps {
  bubbleColor?: string;
  borderColor?: string;
  contentPadding?: number;
  cornerRadius?: number;
  tailSize?: number;
  children: ReactNode;
}

export function DrawInfoBubble({
  bubbleColor = '#ffffff',
  borderColor = '#000000',
  contentPadding = 8,
  cornerRadius = 4,
  tailSize = 8,
  children,
}: DrawInfoBubbleProps) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View
        style={[
          styles.body,
          {
            backgroundColor: bubbleColor,
            borderColor,
            borderRadius: cornerRadius,
            padding: contentPadding,
          },
        ]}
      >
        {children}
      </View>
      <View style={{ height: tailSize }} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={[
          styles.tailBorder,
          {
            borderTopWidth: tailSize,
            borderLeftWidth: tailSize / 2,
            borderRightWidth: tailSize / 2,
            borderTopColor: borderColor,
            marginLeft: -tailSize / 2,
            bottom: 0,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.tailFill,
          {
            borderTopWidth: Math.max(0, tailSize - 2),
            borderLeftWidth: Math.max(0, (tailSize - 2) / 2),
            borderRightWidth: Math.max(0, (tailSize - 2) / 2),
            borderTopColor: bubbleColor,
            marginLeft: -Math.max(0, (tailSize - 2) / 2),
            bottom: 3,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignItems: 'center'
  },
  body: {
    borderWidth: 1,
    minWidth: 1,
  },
  tailSeamCover: {
    position: 'absolute',
    left: '50%',
  },
  tailBorder: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailFill: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
    bottom: 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
