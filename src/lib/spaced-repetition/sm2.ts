export interface SM2Card {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview?: string;
}

export interface SM2Result extends SM2Card {
  quality: number;
}

const MIN_EASE = 1.3;

export function createNewCard(): SM2Card {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
  };
}

/**
 * SM-2 algorithm. Quality 0-5 where:
 * 0-2 = incorrect, 3-5 = correct with varying confidence
 */
export function reviewCard(
  card: SM2Card,
  quality: number,
): SM2Result {
  let { easeFactor, interval, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    MIN_EASE,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: new Date().toISOString(),
    quality,
  };
}

export function qualityFromAnswer(correct: boolean, timeSpentMs: number): number {
  if (!correct) return 1;
  if (timeSpentMs < 15000) return 5;
  if (timeSpentMs < 45000) return 4;
  return 3;
}

export function isDue(nextReview: string): boolean {
  return new Date(nextReview) <= new Date();
}

export function sortByDueDate<T extends { nextReview: string }>(cards: T[]): T[] {
  return [...cards].sort(
    (a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime(),
  );
}
