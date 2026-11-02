/**
 * Who put the pin where it is. 'fixed' means the stored point, a map click or drag, or
 * coordinates handed in by the parent; 'auto' means it was derived from city/address text.
 */
export type PinSource = 'none' | 'auto' | 'fixed';

export type PinTrigger = 'mount' | 'city' | 'address';

/** 'place' moves the pin and saved coordinates; 'pan' moves only the map view. */
export type PinAction = 'place' | 'pan' | 'none';

export function decidePinAction(input: {
  trigger: PinTrigger;
  pinSource: PinSource;
  /** The parent changed coordinates in the same render as the text (e.g. auto-location). */
  coordsSuppliedTogether: boolean;
  /** false when only an explicit map pick may set coordinates (bar locations). */
  autoPlaceFromText: boolean;
}): PinAction {
  const { trigger, pinSource, coordsSuppliedTogether, autoPlaceFromText } = input;
  if (coordsSuppliedTogether) return 'none';

  if (!autoPlaceFromText) {
    if (trigger === 'address') return 'none';
    return trigger === 'mount' && pinSource === 'fixed' ? 'none' : 'pan';
  }

  if (pinSource !== 'fixed') return 'place';
  // Choosing another city keeps a coach's approximate location in that city.
  return trigger === 'city' ? 'place' : 'none';
}
