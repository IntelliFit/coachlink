import { BOJI_SHAPE_COLORS, bojiEnclosureColor } from '@coachlink/core/src/bojiDetector';
export const OVERLAY_LEGEND: { color: string; label: string }[] = [
  { color: BOJI_SHAPE_COLORS.shoulder, label: '肩宽' },
  { color: BOJI_SHAPE_COLORS.waist, label: '最窄腰' },
  { color: BOJI_SHAPE_COLORS.arm, label: '上臂宽度' },
  { color: BOJI_SHAPE_COLORS.alba, label: '腹白线' },
  { color: BOJI_SHAPE_COLORS.groove, label: '腹肌横沟' },
  { color: bojiEnclosureColor(1), label: '腹肌块（越绿越清晰）' },
];
