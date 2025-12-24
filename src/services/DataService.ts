import { Plugin } from 'obsidian';
import {
  Habit,
  HabitLog,
  HabitData,
  DEFAULT_HABIT_DATA,
  createHabit,
  createHabitLog,
  formatDate,
  HabitFrequency,
  Category,
  FreezeDay,
  Badge,
  BadgeType,
  createCategory,
  createFreezeDay,
  createBadge,
  CATEGORY_COLORS,
  BADGE_MILESTONES,
  isFrozenDate,
} from '../models/Habit';

export class DataService {
  private plugin: Plugin;
  private data: HabitData;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.data = DEFAULT_HABIT_DATA;
  }

  async load(): Promise<void> {
    const savedData = await this.plugin.loadData();
    if (savedData) {
      this.data = {
        ...DEFAULT_HABIT_DATA,
        ...savedData,
      };
    }
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  // Habit CRUD operations
  getHabits(includeArchived = false): Habit[] {
    const habits = includeArchived
      ? this.data.habits
      : this.data.habits.filter((h) => !h.archived);
    return habits.sort((a, b) => a.order - b.order);
  }

  getHabit(id: string): Habit | undefined {
    return this.data.habits.find((h) => h.id === id);
  }

  async addHabit(
    name: string,
    frequency: HabitFrequency = 'daily',
    options?: Partial<Habit>
  ): Promise<Habit> {
    const maxOrder = Math.max(0, ...this.data.habits.map((h) => h.order));
    const habit = createHabit(name, frequency, { ...options, order: maxOrder + 1 });
    this.data.habits.push(habit);
    await this.save();
    return habit;
  }

  async updateHabit(id: string, updates: Partial<Habit>): Promise<Habit | undefined> {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return undefined;

    this.data.habits[index] = {
      ...this.data.habits[index],
      ...updates,
      id, // Prevent id from being changed
    };
    await this.save();
    return this.data.habits[index];
  }

  async deleteHabit(id: string): Promise<boolean> {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return false;

    this.data.habits.splice(index, 1);
    // Also remove all logs for this habit
    this.data.logs = this.data.logs.filter((l) => l.habitId !== id);
    await this.save();
    return true;
  }

  async archiveHabit(id: string): Promise<boolean> {
    const habit = await this.updateHabit(id, { archived: true });
    return habit !== undefined;
  }

  async reorderHabits(orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const habit = this.data.habits.find((h) => h.id === id);
      if (habit) {
        habit.order = index;
      }
    });
    await this.save();
  }

  // Habit Log operations
  getLogs(habitId?: string, startDate?: string, endDate?: string): HabitLog[] {
    let logs = this.data.logs;

    if (habitId) {
      logs = logs.filter((l) => l.habitId === habitId);
    }

    if (startDate) {
      logs = logs.filter((l) => l.date >= startDate);
    }

    if (endDate) {
      logs = logs.filter((l) => l.date <= endDate);
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  getLog(habitId: string, date: string): HabitLog | undefined {
    return this.data.logs.find((l) => l.habitId === habitId && l.date === date);
  }

  async toggleHabit(habitId: string, date?: string): Promise<HabitLog> {
    const targetDate = date || formatDate(new Date());
    const existingLog = this.getLog(habitId, targetDate);

    if (existingLog) {
      existingLog.completed = !existingLog.completed;
      existingLog.completedAt = existingLog.completed
        ? new Date().toISOString()
        : undefined;
      await this.save();
      return existingLog;
    } else {
      const newLog = createHabitLog(habitId, targetDate, true);
      this.data.logs.push(newLog);
      await this.save();
      return newLog;
    }
  }

  async setHabitCompletion(
    habitId: string,
    date: string,
    completed: boolean,
    note?: string
  ): Promise<HabitLog> {
    const existingLog = this.getLog(habitId, date);

    if (existingLog) {
      existingLog.completed = completed;
      existingLog.note = note;
      existingLog.completedAt = completed ? new Date().toISOString() : undefined;
      await this.save();
      return existingLog;
    } else {
      const newLog = createHabitLog(habitId, date, completed, note);
      this.data.logs.push(newLog);
      await this.save();
      return newLog;
    }
  }

  // Statistics helpers
  getCompletionRate(habitId: string, days: number): number {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);

    const logs = this.getLogs(habitId, formatDate(startDate), formatDate(today));
    const completedCount = logs.filter((l) => l.completed).length;

    return days > 0 ? (completedCount / days) * 100 : 0;
  }

  getCurrentStreak(habitId: string): number {
    const logs = this.getLogs(habitId).filter((l) => l.completed);
    if (logs.length === 0) return 0;

    const habit = this.getHabit(habitId);
    if (!habit) return 0;

    let streak = 0;
    const today = new Date();
    let currentDate = new Date(today);

    // Check if today is completed
    const todayLog = logs.find((l) => l.date === formatDate(today));
    if (!todayLog) {
      // If today isn't done yet, start counting from yesterday
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (true) {
      const dateStr = formatDate(currentDate);
      const log = logs.find((l) => l.date === dateStr);

      if (log && log.completed) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Check if habit was due on this day
        if (habit.frequency === 'daily') {
          break; // Streak broken
        } else if (habit.customDays) {
          const dayOfWeek = currentDate.getDay();
          if (habit.customDays.includes(dayOfWeek)) {
            break; // Was due but not completed - streak broken
          }
          // Not due on this day, continue checking
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Safety limit to prevent infinite loops
      if (streak > 3650) break;
    }

    return streak;
  }

  getLongestStreak(habitId: string): number {
    const logs = this.getLogs(habitId)
      .filter((l) => l.completed)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (logs.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < logs.length; i++) {
      const prevDate = new Date(logs[i - 1].date);
      const currDate = new Date(logs[i].date);

      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  getTotalCompletions(habitId: string): number {
    return this.getLogs(habitId).filter((l) => l.completed).length;
  }

  // ==================== CATEGORY OPERATIONS ====================

  getCategories(): Category[] {
    return (this.data.categories || []).sort((a, b) => a.order - b.order);
  }

  getCategory(id: string): Category | undefined {
    return this.data.categories?.find((c) => c.id === id);
  }

  async addCategory(name: string, color?: string, emoji?: string): Promise<Category> {
    if (!this.data.categories) this.data.categories = [];

    const maxOrder = Math.max(0, ...this.data.categories.map((c) => c.order));
    const usedColors = this.data.categories.map((c) => c.color);
    const availableColor = color || CATEGORY_COLORS.find((c) => !usedColors.includes(c)) || CATEGORY_COLORS[0];

    const category = createCategory(name, availableColor, { emoji, order: maxOrder + 1 });
    this.data.categories.push(category);
    await this.save();
    return category;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | undefined> {
    if (!this.data.categories) return undefined;

    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) return undefined;

    this.data.categories[index] = {
      ...this.data.categories[index],
      ...updates,
      id,
    };
    await this.save();
    return this.data.categories[index];
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (!this.data.categories) return false;

    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) return false;

    this.data.categories.splice(index, 1);
    // Remove category from all habits that had it
    this.data.habits.forEach((h) => {
      if (h.categoryId === id) {
        h.categoryId = undefined;
      }
    });
    await this.save();
    return true;
  }

  getHabitsByCategory(categoryId?: string): Habit[] {
    const habits = this.getHabits();
    if (categoryId === undefined) {
      return habits.filter((h) => !h.categoryId);
    }
    return habits.filter((h) => h.categoryId === categoryId);
  }

  // ==================== FREEZE DAY OPERATIONS ====================

  getFreezeDays(): FreezeDay[] {
    return this.data.freezeDays || [];
  }

  isFrozen(date: string): boolean {
    return isFrozenDate(date, this.data.freezeDays || []);
  }

  async addFreezeDay(date: string, reason?: string): Promise<FreezeDay | null> {
    if (!this.data.freezeDays) this.data.freezeDays = [];

    // Check if already frozen
    if (this.isFrozen(date)) return null;

    const freezeDay = createFreezeDay(date, reason);
    this.data.freezeDays.push(freezeDay);
    await this.save();
    return freezeDay;
  }

  async removeFreezeDay(date: string): Promise<boolean> {
    if (!this.data.freezeDays) return false;

    const index = this.data.freezeDays.findIndex((f) => f.date === date);
    if (index === -1) return false;

    this.data.freezeDays.splice(index, 1);
    await this.save();
    return true;
  }

  getFreezeDaysThisMonth(): number {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return (this.data.freezeDays || []).filter((f) => f.date.startsWith(monthStr)).length;
  }

  // ==================== BADGE OPERATIONS ====================

  getBadges(habitId?: string): Badge[] {
    const badges = this.data.badges || [];
    if (habitId) {
      return badges.filter((b) => b.habitId === habitId);
    }
    return badges;
  }

  hasBadge(habitId: string, type: BadgeType): boolean {
    return (this.data.badges || []).some((b) => b.habitId === habitId && b.type === type);
  }

  async awardBadge(habitId: string, type: BadgeType): Promise<Badge | null> {
    if (!this.data.badges) this.data.badges = [];

    // Don't award duplicate badges
    if (this.hasBadge(habitId, type)) return null;

    const badge = createBadge(habitId, type);
    this.data.badges.push(badge);
    await this.save();
    return badge;
  }

  // Check and award badges based on current streak
  async checkAndAwardBadges(habitId: string): Promise<Badge[]> {
    const streak = this.getCurrentStreak(habitId);
    const newBadges: Badge[] = [];

    for (const milestone of BADGE_MILESTONES) {
      if (streak >= milestone.days && !this.hasBadge(habitId, milestone.type)) {
        const badge = await this.awardBadge(habitId, milestone.type);
        if (badge) newBadges.push(badge);
      }
    }

    return newBadges;
  }

  getAllBadgesWithDetails(): { badge: Badge; habit: Habit | undefined; milestone: typeof BADGE_MILESTONES[0] }[] {
    return (this.data.badges || []).map((badge) => ({
      badge,
      habit: this.getHabit(badge.habitId),
      milestone: BADGE_MILESTONES.find((m) => m.type === badge.type)!,
    }));
  }

  // ==================== ENHANCED STREAK (with freeze support) ====================

  getCurrentStreakWithFreeze(habitId: string): number {
    const logs = this.getLogs(habitId).filter((l) => l.completed);
    if (logs.length === 0) return 0;

    const habit = this.getHabit(habitId);
    if (!habit) return 0;

    let streak = 0;
    const today = new Date();
    let currentDate = new Date(today);

    // Check if today is completed or frozen
    const todayStr = formatDate(today);
    const todayLog = logs.find((l) => l.date === todayStr);
    const todayFrozen = this.isFrozen(todayStr);

    if (!todayLog && !todayFrozen) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (true) {
      const dateStr = formatDate(currentDate);
      const log = logs.find((l) => l.date === dateStr);
      const frozen = this.isFrozen(dateStr);

      if (frozen) {
        // Frozen day - skip but don't break streak
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }

      if (log && log.completed) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        if (habit.frequency === 'daily') {
          break;
        } else if (habit.customDays) {
          const dayOfWeek = currentDate.getDay();
          if (habit.customDays.includes(dayOfWeek)) {
            break;
          }
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      if (streak > 3650) break;
    }

    return streak;
  }

  // ==================== STATISTICS ====================

  getDayOfWeekStats(habitId: string, days: number = 90): number[] {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);

    const logs = this.getLogs(habitId, formatDate(startDate), formatDate(today));
    const completedLogs = logs.filter((l) => l.completed);

    // Count completions by day of week (0 = Sunday)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    // Count total days per day-of-week in the period
    let date = new Date(startDate);
    while (date <= today) {
      dayTotals[date.getDay()]++;
      date.setDate(date.getDate() + 1);
    }

    // Count completions per day-of-week
    completedLogs.forEach((log) => {
      const d = new Date(log.date);
      dayCounts[d.getDay()]++;
    });

    // Return percentage for each day
    return dayCounts.map((count, i) => (dayTotals[i] > 0 ? (count / dayTotals[i]) * 100 : 0));
  }

  getCompletionTrend(habitId: string, days: number = 30): { date: string; rate: number }[] {
    const today = new Date();
    const result: { date: string; rate: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);

      const log = this.getLog(habitId, dateStr);
      const frozen = this.isFrozen(dateStr);

      result.push({
        date: dateStr,
        rate: frozen ? -1 : (log?.completed ? 100 : 0), // -1 indicates frozen
      });
    }

    return result;
  }

  // ==================== EXPORT/IMPORT ====================

  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  async importData(jsonString: string): Promise<boolean> {
    try {
      const imported = JSON.parse(jsonString) as HabitData;
      if (imported.habits && imported.logs) {
        // Ensure all new fields exist
        this.data = {
          ...DEFAULT_HABIT_DATA,
          ...imported,
        };
        await this.save();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
