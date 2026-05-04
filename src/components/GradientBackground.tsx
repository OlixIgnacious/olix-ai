import React from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

const {width, height} = Dimensions.get('screen');

type Props = {
  gradientId: string;
  startColor?: string;
  endColor?: string;
};

export function GradientBackground({
  gradientId,
  startColor = '#F8F6FF',
  endColor = '#E8E3FF',
}: Props): React.JSX.Element {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.15" y2="1">
            <Stop offset="0" stopColor={startColor} stopOpacity="1" />
            <Stop offset="1" stopColor={endColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
