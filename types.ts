
export enum GameStage {
  VIDEO_INTRO = 'VIDEO_INTRO',
  INTRO = 'INTRO',
  COOKING = 'COOKING',
  TRANSITION_TO_FEEDING = 'TRANSITION_TO_FEEDING',
  FEEDING = 'FEEDING',
  EXPLOSION = 'EXPLOSION',
  AFTERMATH = 'AFTERMATH',
  STATUE = 'STATUE',
}

export enum IngredientType {
  GOOD = 'GOOD',
  BAD = 'BAD',
}

export interface Ingredient {
  id: number;
  x: number;
  y: number;
  vy: number; // Vertical velocity
  vx: number; // Horizontal drift
  rotation: number;
  rotationSpeed: number;
  emoji: string;
  type: IngredientType;
  name: string;
}

export const GOOD_INGREDIENTS = [
  { emoji: '🍅', name: 'Tomato' },
  { emoji: '🍄', name: 'Mushroom' },
  { emoji: '🥦', name: 'Broccoli' },
  { emoji: '🥩', name: 'Meatball' },
  { emoji: '🍤', name: 'Shrimp' },
  { emoji: '🥓', name: 'Bacon' },
];

export const BAD_INGREDIENTS = [
  { emoji: '🔋', name: 'Battery' },
  { emoji: '🍌', name: 'Rotten Banana' },
  { emoji: '💣', name: 'Bomb' },
  { emoji: '🤡', name: 'Meme' },
  { emoji: '💩', name: 'Poop' },
  { emoji: '👽', name: 'Alien' },
];

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
}
