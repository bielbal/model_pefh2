// types.ts
export type Emotion = "neutro" | "feliz" | "triste" | "surpreso" | "bravo" | "calmo";

export interface WordEntry {
  word: string;
  next: Record<string, number>;
  aliases: Record<string, number>;
  emotion: Emotion;
  fn?: string;
}

export type TrainingData = WordEntry[];
export type FnMap = Record<string, (...args: string[]) => string>;   