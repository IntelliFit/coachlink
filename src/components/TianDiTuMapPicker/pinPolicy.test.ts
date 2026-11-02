import { describe, expect, it } from 'vitest'
import { decidePinAction, type PinSource, type PinTrigger } from './pinPolicy'

const decide = (trigger: PinTrigger, pinSource: PinSource, autoPlaceFromText: boolean, coordsSuppliedTogether = false) =>
  decidePinAction({ trigger, pinSource, autoPlaceFromText, coordsSuppliedTogether })

describe('map pin policy', () => {
  describe('bar locations: only a map pick sets coordinates', () => {
    it('never moves an existing pin from text or on load', () => {
      expect(decide('mount', 'fixed', false)).toBe('none')
      expect(decide('address', 'fixed', false)).toBe('none')
    })

    it('only pans the view for a city, even without a pin', () => {
      expect(decide('city', 'fixed', false)).toBe('pan')
      expect(decide('city', 'none', false)).toBe('pan')
      expect(decide('mount', 'none', false)).toBe('pan')
    })

    it('does not invent coordinates from typed text', () => {
      expect(decide('address', 'none', false)).toBe('none')
    })
  })

  describe('coach locations: text may place an approximate pin', () => {
    it('keeps a stored or picked point on load and while typing an address', () => {
      expect(decide('mount', 'fixed', true)).toBe('none')
      expect(decide('address', 'fixed', true)).toBe('none')
    })

    it('follows an explicitly chosen city', () => {
      expect(decide('city', 'fixed', true)).toBe('place')
    })

    it('places and refines a pin that only came from text', () => {
      expect(decide('mount', 'none', true)).toBe('place')
      expect(decide('city', 'none', true)).toBe('place')
      expect(decide('address', 'auto', true)).toBe('place')
    })
  })

  it('lets coordinates supplied with the text win (auto-location, loaded data)', () => {
    expect(decide('city', 'none', true, true)).toBe('none')
    expect(decide('city', 'fixed', true, true)).toBe('none')
    expect(decide('mount', 'none', false, true)).toBe('none')
  })
})
