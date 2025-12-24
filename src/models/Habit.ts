export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type BadgeType = 'week' | 'month' | 'century' | 'year';

// Category for organizing habits
export interface Category {
  id: string;
  name: string;
  color: string; // Hex color like #4CAF50
  emoji?: string;
  order: number;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  frequency: HabitFrequency;
  customDays?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  categoryId?: string; // Link to category
  goalDays?: number; // Target for milestone (7, 30, 100, 365)
  createdAt: string; // ISO date string
  archived: boolean;
  order: number; // For sorting habits in the UI
}

export interface HabitLog {
  date: string; // YYYY-MM-DD format
  habitId: string;
  completed: boolean;
  note?: string;
  completedAt?: string; // ISO timestamp when marked complete
}

// Freeze day for streak protection
export interface FreezeDay {
  date: string; // YYYY-MM-DD
  reason?: string; // Optional: "Vacation", "Sick", etc.
}

// Badge earned for milestones
export interface Badge {
  id: string;
  habitId: string;
  type: BadgeType;
  earnedAt: string; // ISO timestamp
}

export interface HabitData {
  habits: Habit[];
  logs: HabitLog[];
  categories: Category[];
  freezeDays: FreezeDay[];
  badges: Badge[];
  version: number; // For future data migrations
}

export const DEFAULT_HABIT_DATA: HabitData = {
  habits: [],
  logs: [],
  categories: [],
  freezeDays: [],
  badges: [],
  version: 2,
};

// Default category colors
export const CATEGORY_COLORS = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#795548', // Brown
];

// Badge definitions
export const BADGE_MILESTONES: { type: BadgeType; days: number; emoji: string; label: string }[] = [
  { type: 'week', days: 7, emoji: '🔥', label: 'First Week' },
  { type: 'month', days: 30, emoji: '⭐', label: 'Monthly Master' },
  { type: 'century', days: 100, emoji: '💎', label: 'Century Club' },
  { type: 'year', days: 365, emoji: '👑', label: 'Year Champion' },
];

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createHabit(
  name: string,
  frequency: HabitFrequency = 'daily',
  options?: Partial<Omit<Habit, 'id' | 'name' | 'frequency' | 'createdAt' | 'archived'>>
): Habit {
  return {
    id: generateId(),
    name,
    frequency,
    createdAt: new Date().toISOString(),
    archived: false,
    order: 0,
    ...options,
  };
}

export function createHabitLog(
  habitId: string,
  date: string,
  completed: boolean,
  note?: string
): HabitLog {
  return {
    date,
    habitId,
    completed,
    note,
    completedAt: completed ? new Date().toISOString() : undefined,
  };
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00');
}

export function isHabitDueOnDate(habit: Habit, date: Date): boolean {
  const dayOfWeek = date.getDay();

  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      // Default to Sunday if no custom days specified
      return habit.customDays?.includes(dayOfWeek) ?? dayOfWeek === 0;
    case 'custom':
      return habit.customDays?.includes(dayOfWeek) ?? false;
  }
}

export function createCategory(
  name: string,
  color: string,
  options?: Partial<Omit<Category, 'id' | 'name' | 'color'>>
): Category {
  return {
    id: generateId(),
    name,
    color,
    order: 0,
    ...options,
  };
}

export function createFreezeDay(date: string, reason?: string): FreezeDay {
  return {
    date,
    reason,
  };
}

export function createBadge(habitId: string, type: BadgeType): Badge {
  return {
    id: generateId(),
    habitId,
    type,
    earnedAt: new Date().toISOString(),
  };
}

export function isFrozenDate(date: string, freezeDays: FreezeDay[]): boolean {
  return freezeDays.some((f) => f.date === date);
}

export function getFreezeDaysInMonth(year: number, month: number, freezeDays: FreezeDay[]): FreezeDay[] {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  return freezeDays.filter((f) => f.date.startsWith(monthStr));
}
