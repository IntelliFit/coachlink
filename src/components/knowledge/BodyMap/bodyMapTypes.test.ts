import { describe, it, expect } from 'vitest';
import {
  BODY_PART_CATEGORY_MAP,
  CATEGORY_TO_BODY_PARTS,
  getCategory,
  isJoint,
  SVG_BODY_PART_NAMES,
  SVG_BODY_CATEGORIES,
} from './bodyMapTypes';

describe('bodyMapTypes', () => {
  describe('BODY_PART_CATEGORY_MAP', () => {
    it('should map professional names to categories', () => {
      expect(BODY_PART_CATEGORY_MAP['胸大肌上部']).toBe('胸部');
      expect(BODY_PART_CATEGORY_MAP['三角肌前束']).toBe('肩部');
      expect(BODY_PART_CATEGORY_MAP['肱二头肌']).toBe('大臂');
      expect(BODY_PART_CATEGORY_MAP['腕关节']).toBe('关节');
    });

    it('should cover all major body parts', () => {
      expect(SVG_BODY_PART_NAMES.length).toBeGreaterThan(20);
      expect(SVG_BODY_CATEGORIES.length).toBeGreaterThan(5);
    });
  });

  describe('CATEGORY_TO_BODY_PARTS', () => {
    it('should map categories to their professional names', () => {
      expect(CATEGORY_TO_BODY_PARTS['胸部']).toContain('胸大肌上部');
      expect(CATEGORY_TO_BODY_PARTS['胸部']).toContain('胸大肌中部');
      expect(CATEGORY_TO_BODY_PARTS['胸部']).toContain('胸大肌下部');
      expect(CATEGORY_TO_BODY_PARTS['肩部']).toContain('三角肌前束');
    });
  });

  describe('getCategory', () => {
    it('should return category for SVG data-name', () => {
      expect(getCategory('股直肌')).toBe('大腿');
      expect(getCategory('背阔肌')).toBe('背部');
    });

    it('should return category for legacy names', () => {
      expect(getCategory('斜方肌')).toBe('背部');
      expect(getCategory('胸大肌')).toBe('胸部');
    });

    it('should return null for unknown names', () => {
      expect(getCategory('未知部位')).toBeNull();
    });
  });

  describe('isJoint', () => {
    it('should return true for joints', () => {
      expect(isJoint('腕关节')).toBe(true);
      expect(isJoint('膝关节')).toBe(true);
    });

    it('should return false for muscles', () => {
      expect(isJoint('肱二头肌')).toBe(false);
      expect(isJoint('胸大肌上部')).toBe(false);
    });
  });
});
