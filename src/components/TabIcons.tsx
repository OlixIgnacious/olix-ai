import React from 'react';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';

// Boxi logo mark — isometric box, black fill with white top face + shelf lines.
export function BoxiIcon({size = 32}: {size?: number}): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Full cube silhouette */}
      <Path d="M50 8 L91 31 L91 72 L50 92 L9 72 L9 31 Z" fill="#0A0A0A" />
      {/* Top face — white negative space */}
      <Path d="M50 8 L91 31 L50 52 L9 31 Z" fill="#FFFFFF" />
      {/* Three dots on top face */}
      <Circle cx="37" cy="34" r="4.5" fill="#0A0A0A" />
      <Circle cx="50" cy="40" r="4.5" fill="#0A0A0A" />
      <Circle cx="63" cy="34" r="4.5" fill="#0A0A0A" />
      {/* Shelf dividers on right face — two white horizontal bars */}
      <Path d="M51 65 L89 43 L89 50 L51 72 Z" fill="#FFFFFF" />
      <Path d="M51 76 L89 54 L89 61 L51 83 Z" fill="#FFFFFF" />
    </Svg>
  );
}

type IconProps = {color: string; size?: number};

export function HomeIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9 21V13h6v8" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MicIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth={1.8} />
      <Path d="M5 10a7 7 0 0014 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 17v4M8 21h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({color, size = 28}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.8} />
      <Line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function SpeakerIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5L6 9H3a1 1 0 00-1 1v4a1 1 0 001 1h3l5 4V5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d="M15.5 8.5a5 5 0 010 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M18.5 5.5a9 9 0 010 13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function LockIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BoltIcon({color, size = 22}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function NewChatIcon({color, size = 28}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d="M12 9v6M9 12h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
