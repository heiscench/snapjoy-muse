import { describe, expect, it } from 'vitest';
import { CHARACTER_VARIANTS, characterVariant, hasMonsterEyes } from './characterAppearance';
describe('NFT appearance rules', () => {
  it('keeps an identity variant stable across repeated client evaluations', () => {
    expect(characterVariant('being-1111')).toBe('gray-beanie');
    expect(Array.from({ length: 50 }, () => characterVariant('being-1111')).every(v => v === characterVariant('being-1111'))).toBe(true);
  });
  it('uses all nine clothing/headwear variants', () => {
    expect(new Set(Array.from({ length: 300 }, (_, id) => characterVariant(id))).size).toBe(CHARACTER_VARIANTS.length);
  });
  it('limits extra eyes to a small minority of Monster beings', () => {
    const ids = Array.from({ length: 700 }, (_, id) => id);
    expect(ids.filter(id => hasMonsterEyes(id, 0))).toHaveLength(0);
    expect(ids.filter(id => hasMonsterEyes(id, 1))).toHaveLength(0);
    expect(ids.filter(id => hasMonsterEyes(id, 2))).toHaveLength(0);
    const monsters = ids.filter(id => hasMonsterEyes(id, 3)).length;
    expect(monsters).toBeGreaterThan(50);
    expect(monsters).toBeLessThan(150);
  });
});
