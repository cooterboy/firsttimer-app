import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Ported from the prototype's nav.tabs SVGs — same paths, same viewBox.
export function TodayIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M6 4v16M18 4v16M3 9h4M17 9h4M3 15h4M17 15h4" strokeLinecap="round" />
    </Svg>
  );
}
export function ProgressIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M4 19h16M6 15l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function ProgramsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Rect x={4} y={4} width={16} height={16} rx={3} />
      <Path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </Svg>
  );
}
export function ShopIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M6 8h12l1 12H5L6 8zM9 8a3 3 0 0 1 6 0" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function YouIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={8} r={3.4} />
      <Path d="M4.5 20c1.4-3.8 4.4-5.8 7.5-5.8s6.1 2 7.5 5.8" strokeLinecap="round" />
    </Svg>
  );
}
