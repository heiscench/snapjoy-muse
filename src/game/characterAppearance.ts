/** Presentation only: persisted faction and player identifiers are never rewritten. */
export const CHARACTER_VARIANTS = ['gray-beanie', 'purple-beanie', 'frog-hat', 'bun', 'samurai', 'hood', 'skeleton', 'lightning', 'cardigan'] as const;
export type CharacterVariant = typeof CHARACTER_VARIANTS[number];
export type CharacterRole = 'faction' | 'civilian' | 'guard';
export function appearanceHash(id: string | number) {
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function characterVariant(id: string | number): CharacterVariant {
  return CHARACTER_VARIANTS[appearanceHash(id) % CHARACTER_VARIANTS.length];
}
export function hasMonsterEyes(id: string | number, faction: number) {
  return faction === 3 && appearanceHash(id) % 7 === 0;
}
export const CHARACTER_PALETTE = {
  ink: '#14111c', outline: '#050409', hair: '#201728', skin: '#e9b593',
  violet: '#b374ff', drip: '#4c256c', bone: '#f0e8dc', gray: '#55545c',
  frog: '#79c632', crimson: '#d83759', gold: '#b49a60', blue: '#45a5cf',
  civilian: ['#75717a', '#747c80', '#818076', '#686f68', '#85747c'],
};
