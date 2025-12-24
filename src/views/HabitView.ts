import { ItemView, WorkspaceLeaf, Menu, Notice } from 'obsidian';
import HabitTrackerPlugin from '../../main';
import {
  Habit,
  Category,
  formatDate,
  isHabitDueOnDate,
  CATEGORY_COLORS,
  BADGE_MILESTONES,
  Badge,
} from '../models/Habit';

export const HABIT_VIEW_TYPE = 'habit-tracker-view';

// Habit Templates
const HABIT_TEMPLATES = {
  morning: {
    name: '🌅 Morning Routine',
    habits: [
      { name: 'Wake up early', emoji: '⏰' },
      { name: 'Drink water', emoji: '💧' },
      { name: 'Stretch/Exercise', emoji: '🧘' },
      { name: 'Journal', emoji: '📝' },
      { name: 'Plan the day', emoji: '📋' },
      { name: 'Healthy breakfast', emoji: '🥣' },
    ],
  },
  fitness: {
    name: '💪 Fitness & Health',
    habits: [
      { name: 'Exercise 30min', emoji: '🏃' },
      { name: '10,000 steps', emoji: '👟' },
      { name: 'Healthy meals', emoji: '🥗' },
      { name: 'Sleep 7+ hours', emoji: '😴' },
      { name: 'No alcohol', emoji: '🚫' },
      { name: 'Take vitamins', emoji: '💊' },
    ],
  },
  productivity: {
    name: '🎯 Productivity',
    habits: [
      { name: 'Deep work session', emoji: '🎯' },
      { name: 'No social media', emoji: '📵' },
      { name: 'Learn something new', emoji: '📚' },
      { name: 'Review goals', emoji: '🎯' },
      { name: 'Inbox zero', emoji: '📧' },
    ],
  },
  mindfulness: {
    name: '🧘 Mindfulness',
    habits: [
      { name: 'Meditate', emoji: '🧘' },
      { name: 'Gratitude practice', emoji: '🙏' },
      { name: 'Screen-free hour', emoji: '📴' },
      { name: 'Time in nature', emoji: '🌳' },
    ],
  },
  learning: {
    name: '📚 Learning',
    habits: [
      { name: 'Read 30 minutes', emoji: '📖' },
      { name: 'Practice a skill', emoji: '🎸' },
      { name: 'Take notes', emoji: '✍️' },
      { name: 'Teach someone', emoji: '👨‍🏫' },
    ],
  },
};

export class HabitView extends ItemView {
  plugin: HabitTrackerPlugin;
  private currentDate: Date;
  private currentTab: 'today' | 'calendar' | 'stats' | 'badges';
  private selectedCategoryFilter: string | null = null;
  private selectedHabitForCalendar: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: HabitTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.currentTab = plugin.settings.defaultView;
  }

  getViewType(): string {
    return HABIT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Habit Tracker';
  }

  getIcon(): string {
    return 'check-circle';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {}

  render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('habit-tracker-container');

    this.renderHeader(container);

    const content = container.createDiv({ cls: 'habit-content' });

    switch (this.currentTab) {
      case 'today':
        this.renderTodayView(content);
        break;
      case 'calendar':
        this.renderCalendarView(content);
        break;
      case 'stats':
        this.renderStatsView(content);
        break;
      case 'badges':
        this.renderBadgesView(content);
        break;
    }
  }

  private renderHeader(container: Element): void {
    const header = container.createDiv({ cls: 'habit-header' });

    const tabs = header.createDiv({ cls: 'habit-tabs' });

    const tabItems: { key: typeof this.currentTab; label: string }[] = [
      { key: 'today', label: 'Today' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'stats', label: 'Stats' },
      { key: 'badges', label: 'Badges' },
    ];

    tabItems.forEach(({ key, label }) => {
      const tab = tabs.createEl('button', {
        cls: `habit-tab ${this.currentTab === key ? 'active' : ''}`,
        text: label,
      });
      tab.addEventListener('click', () => {
        this.currentTab = key;
        this.render();
      });
    });

    const actions = header.createDiv({ cls: 'habit-actions' });

    // Templates button
    const templatesBtn = actions.createEl('button', {
      cls: 'habit-action-btn',
      text: '📦 Templates',
    });
    templatesBtn.addEventListener('click', () => this.showTemplatesModal());

    // Add habit button
    const addBtn = actions.createEl('button', {
      cls: 'habit-add-btn',
      text: '+ New Habit',
    });
    addBtn.addEventListener('click', () => this.showAddHabitModal());
  }

  private renderTodayView(container: Element): void {
    const today = new Date();
    const dateStr = formatDate(today);
    const isFrozen = this.plugin.dataService.isFrozen(dateStr);

    // Date header with freeze option
    const dateHeader = container.createDiv({ cls: 'habit-date-header' });
    const dateTitle = dateHeader.createDiv({ cls: 'date-title-row' });
    dateTitle.createEl('h2', {
      text: today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    });

    // Freeze day toggle
    const freezeBtn = dateTitle.createEl('button', {
      cls: `freeze-btn ${isFrozen ? 'frozen' : ''}`,
      text: isFrozen ? '❄️ Frozen' : '❄️ Freeze Day',
    });
    freezeBtn.addEventListener('click', async () => {
      if (isFrozen) {
        await this.plugin.dataService.removeFreezeDay(dateStr);
        new Notice('Day unfrozen');
      } else {
        const freezesUsed = this.plugin.dataService.getFreezeDaysThisMonth();
        if (freezesUsed >= 2) {
          new Notice('You can only freeze 2 days per month');
          return;
        }
        await this.plugin.dataService.addFreezeDay(dateStr, 'Rest day');
        new Notice('Day frozen! Your streaks are protected.');
      }
      this.render();
    });

    if (isFrozen) {
      container.createEl('div', {
        cls: 'frozen-notice',
        text: '❄️ This day is frozen. Habits won\'t affect your streaks.',
      });
    }

    // Category filter
    const categories = this.plugin.dataService.getCategories();
    if (categories.length > 0) {
      const filterRow = container.createDiv({ cls: 'category-filter-row' });
      filterRow.createEl('span', { text: 'Filter: ', cls: 'filter-label' });

      const allBtn = filterRow.createEl('button', {
        cls: `category-filter-btn ${this.selectedCategoryFilter === null ? 'active' : ''}`,
        text: 'All',
      });
      allBtn.addEventListener('click', () => {
        this.selectedCategoryFilter = null;
        this.render();
      });

      categories.forEach((cat) => {
        const btn = filterRow.createEl('button', {
          cls: `category-filter-btn ${this.selectedCategoryFilter === cat.id ? 'active' : ''}`,
          text: (cat.emoji || '') + ' ' + cat.name,
        });
        btn.style.setProperty('--cat-color', cat.color);
        btn.addEventListener('click', () => {
          this.selectedCategoryFilter = cat.id;
          this.render();
        });
      });
    }

    // Progress summary
    let habits = this.plugin.dataService.getHabits();
    if (this.selectedCategoryFilter) {
      habits = habits.filter((h) => h.categoryId === this.selectedCategoryFilter);
    }
    const dueToday = habits.filter((h) => isHabitDueOnDate(h, today));
    const completedToday = dueToday.filter((h) => {
      const log = this.plugin.dataService.getLog(h.id, dateStr);
      return log?.completed;
    });

    const progress = container.createDiv({ cls: 'habit-progress' });
    const progressBar = progress.createDiv({ cls: 'habit-progress-bar' });
    const percentage = dueToday.length > 0 ? (completedToday.length / dueToday.length) * 100 : 0;
    progressBar.createDiv({
      cls: 'habit-progress-fill',
      attr: { style: `width: ${percentage}%` },
    });
    progress.createEl('span', {
      cls: 'habit-progress-text',
      text: `${completedToday.length}/${dueToday.length} completed`,
    });

    // Render habits grouped by category
    const habitList = container.createDiv({ cls: 'habit-list' });

    if (dueToday.length === 0) {
      habitList.createEl('p', {
        cls: 'habit-empty',
        text: 'No habits due today. Add a new habit to get started!',
      });
      return;
    }

    // Group by category
    const uncategorized = dueToday.filter((h) => !h.categoryId);
    const categorized = new Map<string, Habit[]>();

    categories.forEach((cat) => {
      const catHabits = dueToday.filter((h) => h.categoryId === cat.id);
      if (catHabits.length > 0) {
        categorized.set(cat.id, catHabits);
      }
    });

    // Render uncategorized first
    if (uncategorized.length > 0 && !this.selectedCategoryFilter) {
      uncategorized.forEach((habit) => {
        this.renderHabitItem(habitList, habit, dateStr);
      });
    }

    // Render each category
    categorized.forEach((catHabits, catId) => {
      const cat = this.plugin.dataService.getCategory(catId);
      if (!cat) return;

      if (!this.selectedCategoryFilter) {
        const catHeader = habitList.createDiv({ cls: 'category-header' });
        catHeader.createEl('span', {
          cls: 'category-dot',
          attr: { style: `background-color: ${cat.color}` },
        });
        catHeader.createEl('span', { text: (cat.emoji || '') + ' ' + cat.name });
      }

      catHabits.forEach((habit) => {
        this.renderHabitItem(habitList, habit, dateStr, cat);
      });
    });
  }

  private renderHabitItem(container: Element, habit: Habit, dateStr: string, category?: Category): void {
    const log = this.plugin.dataService.getLog(habit.id, dateStr);
    const isCompleted = log?.completed ?? false;
    const streak = this.plugin.dataService.getCurrentStreakWithFreeze(habit.id);
    const isFrozen = this.plugin.dataService.isFrozen(dateStr);

    const item = container.createDiv({
      cls: `habit-item ${isCompleted ? 'completed' : ''} ${isFrozen ? 'frozen' : ''}`,
    });

    if (category) {
      item.style.setProperty('--habit-accent', category.color);
    }

    // Checkbox
    const checkbox = item.createDiv({ cls: 'habit-checkbox' });
    const checkInput = checkbox.createEl('input', {
      type: 'checkbox',
      cls: 'habit-checkbox-input',
    });
    if (isCompleted) {
      checkInput.checked = true;
    }
    checkbox.addEventListener('click', async () => {
      const wasCompleted = isCompleted;
      await this.plugin.dataService.toggleHabit(habit.id, dateStr);

      // Check for new badges
      if (!wasCompleted) {
        const newBadges = await this.plugin.dataService.checkAndAwardBadges(habit.id);
        if (newBadges.length > 0) {
          this.showBadgeEarnedAnimation(newBadges[0], habit);
        } else if (this.plugin.settings.showStreakNotifications) {
          this.showCompletionAnimation();
        }
      }

      this.render();
      this.plugin.updateStatusBar();
    });

    // Habit info
    const info = item.createDiv({ cls: 'habit-info' });
    const nameRow = info.createDiv({ cls: 'habit-name-row' });

    const name = nameRow.createDiv({ cls: 'habit-name' });
    if (habit.emoji) {
      name.createSpan({ text: habit.emoji + ' ' });
    }
    name.createSpan({ text: habit.name });

    // Progress ring for goals
    if (habit.goalDays) {
      const progress = Math.min(100, (streak / habit.goalDays) * 100);
      const ring = nameRow.createDiv({ cls: 'progress-ring-small' });
      ring.innerHTML = this.createProgressRingSVG(progress, 16);
      ring.title = `${streak}/${habit.goalDays} days to goal`;
    }

    // Streak badge
    if (streak > 0) {
      const streakBadge = info.createEl('span', {
        cls: 'habit-streak',
        text: `🔥 ${streak} day${streak > 1 ? 's' : ''}`,
      });

      // Highlight milestone streaks
      if (streak === 7 || streak === 30 || streak === 100 || streak === 365) {
        streakBadge.addClass('milestone');
      }
    }

    // Context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showHabitMenu(e, habit);
    });
  }

  private createProgressRingSVG(percentage: number, size: number): string {
    const strokeWidth = 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle
          cx="${size/2}" cy="${size/2}" r="${radius}"
          fill="none"
          stroke="var(--background-modifier-border)"
          stroke-width="${strokeWidth}"
        />
        <circle
          cx="${size/2}" cy="${size/2}" r="${radius}"
          fill="none"
          stroke="var(--interactive-accent)"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          stroke-linecap="round"
          transform="rotate(-90 ${size/2} ${size/2})"
        />
      </svg>
    `;
  }

  private showCompletionAnimation(): void {
    // Simple confetti animation
    const confetti = document.createElement('div');
    confetti.className = 'confetti-container';
    confetti.innerHTML = '🎉';
    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), 1000);
  }

  private showBadgeEarnedAnimation(badge: Badge, habit: Habit): void {
    const milestone = BADGE_MILESTONES.find((m) => m.type === badge.type);
    if (!milestone) return;

    const overlay = document.createElement('div');
    overlay.className = 'badge-earned-overlay';
    overlay.innerHTML = `
      <div class="badge-earned-content">
        <div class="badge-earned-emoji">${milestone.emoji}</div>
        <div class="badge-earned-title">Badge Earned!</div>
        <div class="badge-earned-name">${milestone.label}</div>
        <div class="badge-earned-habit">${habit.emoji || ''} ${habit.name}</div>
        <div class="badge-earned-streak">${milestone.days} day streak!</div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => overlay.remove());
    setTimeout(() => overlay.remove(), 3000);
  }

  private renderCalendarView(container: Element): void {
    const habits = this.plugin.dataService.getHabits();

    if (habits.length === 0) {
      container.createEl('p', {
        cls: 'habit-empty',
        text: 'No habits yet. Add a habit to see your calendar!',
      });
      return;
    }

    // Month navigation
    const nav = container.createDiv({ cls: 'calendar-nav' });
    const prevBtn = nav.createEl('button', { text: '‹', cls: 'nav-btn' });
    prevBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    nav.createEl('span', {
      cls: 'calendar-month',
      text: this.currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    });

    const nextBtn = nav.createEl('button', { text: '›', cls: 'nav-btn' });
    nextBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    // Habit selector
    const selector = container.createDiv({ cls: 'calendar-habit-selector' });

    if (!this.selectedHabitForCalendar) {
      this.selectedHabitForCalendar = habits[0].id;
    }

    habits.forEach((habit) => {
      const btn = selector.createEl('button', {
        cls: `calendar-habit-btn ${this.selectedHabitForCalendar === habit.id ? 'active' : ''}`,
        text: (habit.emoji || '•') + ' ' + habit.name,
      });
      btn.addEventListener('click', () => {
        this.selectedHabitForCalendar = habit.id;
        this.render();
      });
    });

    // Heatmap
    const heatmap = container.createDiv({ cls: 'calendar-heatmap' });
    this.renderHeatmap(heatmap, this.selectedHabitForCalendar!);

    // Legend
    const legend = container.createDiv({ cls: 'calendar-legend' });
    legend.createEl('span', { text: '✓ Completed', cls: 'legend-item completed' });
    legend.createEl('span', { text: '❄️ Frozen', cls: 'legend-item frozen' });
    legend.createEl('span', { text: '○ Missed', cls: 'legend-item missed' });
  }

  private renderHeatmap(container: Element, habitId: string): void {
    container.empty();

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();

    // Day labels
    const dayLabels = container.createDiv({ cls: 'heatmap-days' });
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => {
      dayLabels.createEl('span', { text: d });
    });

    // Calendar grid
    const grid = container.createDiv({ cls: 'heatmap-grid' });

    // Empty cells for offset
    for (let i = 0; i < startOffset; i++) {
      grid.createDiv({ cls: 'heatmap-cell empty' });
    }

    // Days of month
    const todayStr = formatDate(new Date());
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      const log = this.plugin.dataService.getLog(habitId, dateStr);
      const isCompleted = log?.completed ?? false;
      const isToday = dateStr === todayStr;
      const isFuture = date > new Date();
      const isFrozen = this.plugin.dataService.isFrozen(dateStr);

      const cell = grid.createDiv({
        cls: `heatmap-cell ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''} ${isFrozen ? 'frozen' : ''}`,
      });

      if (isFrozen && !isCompleted) {
        cell.createEl('span', { text: '❄️', cls: 'cell-icon' });
      } else {
        cell.createEl('span', { text: String(day) });
      }

      if (!isFuture) {
        cell.addEventListener('click', async () => {
          await this.plugin.dataService.toggleHabit(habitId, dateStr);
          this.render();
          this.plugin.updateStatusBar();
        });

        // Right click to freeze
        cell.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          if (isFrozen) {
            await this.plugin.dataService.removeFreezeDay(dateStr);
          } else {
            await this.plugin.dataService.addFreezeDay(dateStr);
          }
          this.render();
        });
      }
    }
  }

  private renderStatsView(container: Element): void {
    const habits = this.plugin.dataService.getHabits();

    if (habits.length === 0) {
      container.createEl('p', {
        cls: 'habit-empty',
        text: 'No habits yet. Add a habit to see your stats!',
      });
      return;
    }

    // Overall stats
    const overall = container.createDiv({ cls: 'stats-overall' });
    overall.createEl('h3', { text: 'Overview' });

    const statsGrid = overall.createDiv({ cls: 'stats-grid' });

    // Stats cards
    this.renderStatCard(statsGrid, 'Active Habits', String(habits.length), '🎯');

    const totalCompletions = habits.reduce(
      (sum, h) => sum + this.plugin.dataService.getTotalCompletions(h.id), 0
    );
    this.renderStatCard(statsGrid, 'Total Check-ins', String(totalCompletions), '✓');

    const bestStreak = Math.max(0, ...habits.map((h) => this.plugin.dataService.getLongestStreak(h.id)));
    this.renderStatCard(statsGrid, 'Best Streak', `${bestStreak} days`, '🔥');

    const avgRate = habits.length > 0
      ? habits.reduce((sum, h) => sum + this.plugin.dataService.getCompletionRate(h.id, 7), 0) / habits.length
      : 0;
    this.renderStatCard(statsGrid, '7-Day Average', `${avgRate.toFixed(0)}%`, '📈');

    const totalBadges = this.plugin.dataService.getBadges().length;
    this.renderStatCard(statsGrid, 'Badges Earned', String(totalBadges), '🏆');

    const freezesUsed = this.plugin.dataService.getFreezeDaysThisMonth();
    this.renderStatCard(statsGrid, 'Freezes Used', `${freezesUsed}/2`, '❄️');

    // Day of week chart
    if (habits.length > 0) {
      const chartSection = container.createDiv({ cls: 'stats-chart-section' });
      chartSection.createEl('h3', { text: 'Best Days of the Week' });

      // Aggregate day of week stats across all habits
      const dayStats = [0, 0, 0, 0, 0, 0, 0];
      habits.forEach((h) => {
        const stats = this.plugin.dataService.getDayOfWeekStats(h.id, 90);
        stats.forEach((val, i) => dayStats[i] += val);
      });
      dayStats.forEach((val, i) => dayStats[i] = dayStats[i] / habits.length);

      this.renderDayOfWeekChart(chartSection, dayStats);
    }

    // Per-habit stats
    const perHabit = container.createDiv({ cls: 'stats-per-habit' });
    perHabit.createEl('h3', { text: 'By Habit' });

    habits.forEach((habit) => {
      const card = perHabit.createDiv({ cls: 'habit-stat-card' });

      const header = card.createDiv({ cls: 'habit-stat-header' });
      header.createEl('span', {
        cls: 'habit-stat-name',
        text: (habit.emoji || '•') + ' ' + habit.name,
      });

      // Badges for this habit
      const badges = this.plugin.dataService.getBadges(habit.id);
      if (badges.length > 0) {
        const badgeRow = header.createDiv({ cls: 'habit-badges-inline' });
        badges.forEach((b) => {
          const milestone = BADGE_MILESTONES.find((m) => m.type === b.type);
          if (milestone) {
            badgeRow.createEl('span', { text: milestone.emoji, title: milestone.label });
          }
        });
      }

      const metrics = card.createDiv({ cls: 'habit-stat-metrics' });

      const currentStreak = this.plugin.dataService.getCurrentStreakWithFreeze(habit.id);
      const longestStreak = this.plugin.dataService.getLongestStreak(habit.id);
      const rate7 = this.plugin.dataService.getCompletionRate(habit.id, 7);
      const rate30 = this.plugin.dataService.getCompletionRate(habit.id, 30);

      metrics.createEl('div', { cls: 'habit-stat-metric', text: `Current: ${currentStreak} days` });
      metrics.createEl('div', { cls: 'habit-stat-metric', text: `Best: ${longestStreak} days` });
      metrics.createEl('div', { cls: 'habit-stat-metric', text: `7d: ${rate7.toFixed(0)}%` });
      metrics.createEl('div', { cls: 'habit-stat-metric', text: `30d: ${rate30.toFixed(0)}%` });
    });
  }

  private renderDayOfWeekChart(container: Element, dayStats: number[]): void {
    const chart = container.createDiv({ cls: 'day-chart' });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxVal = Math.max(...dayStats, 1);

    days.forEach((day, i) => {
      const bar = chart.createDiv({ cls: 'day-bar' });
      const fill = bar.createDiv({ cls: 'day-bar-fill' });
      fill.style.height = `${(dayStats[i] / maxVal) * 100}%`;
      bar.createEl('span', { cls: 'day-label', text: day });
      bar.createEl('span', { cls: 'day-value', text: `${dayStats[i].toFixed(0)}%` });
    });
  }

  private renderStatCard(container: Element, label: string, value: string, icon: string): void {
    const card = container.createDiv({ cls: 'stat-card' });
    card.createEl('div', { cls: 'stat-icon', text: icon });
    card.createEl('div', { cls: 'stat-value', text: value });
    card.createEl('div', { cls: 'stat-label', text: label });
  }

  private renderBadgesView(container: Element): void {
    const allBadges = this.plugin.dataService.getAllBadgesWithDetails();

    container.createEl('h2', { text: '🏆 Achievement Gallery', cls: 'badges-title' });

    if (allBadges.length === 0) {
      const emptyState = container.createDiv({ cls: 'badges-empty' });
      emptyState.createEl('div', { cls: 'badges-empty-icon', text: '🏆' });
      emptyState.createEl('p', { text: 'No badges earned yet.' });
      emptyState.createEl('p', { cls: 'badges-empty-hint', text: 'Keep up your streaks to earn badges!' });

      // Show available badges
      const available = container.createDiv({ cls: 'badges-available' });
      available.createEl('h3', { text: 'Badges to Earn' });

      const badgeGrid = available.createDiv({ cls: 'badge-grid' });
      BADGE_MILESTONES.forEach((milestone) => {
        const badge = badgeGrid.createDiv({ cls: 'badge-item locked' });
        badge.createEl('div', { cls: 'badge-emoji', text: milestone.emoji });
        badge.createEl('div', { cls: 'badge-name', text: milestone.label });
        badge.createEl('div', { cls: 'badge-requirement', text: `${milestone.days} day streak` });
      });
      return;
    }

    // Earned badges
    const earned = container.createDiv({ cls: 'badges-earned' });
    earned.createEl('h3', { text: `Earned (${allBadges.length})` });

    const badgeGrid = earned.createDiv({ cls: 'badge-grid' });
    allBadges.forEach(({ badge, habit, milestone }) => {
      const badgeEl = badgeGrid.createDiv({ cls: 'badge-item earned' });
      badgeEl.createEl('div', { cls: 'badge-emoji', text: milestone.emoji });
      badgeEl.createEl('div', { cls: 'badge-name', text: milestone.label });
      badgeEl.createEl('div', { cls: 'badge-habit', text: (habit?.emoji || '') + ' ' + (habit?.name || 'Unknown') });
      badgeEl.createEl('div', { cls: 'badge-date', text: new Date(badge.earnedAt).toLocaleDateString() });
    });

    // Show remaining badges to earn
    const habits = this.plugin.dataService.getHabits();
    const earnedTypes = new Set(allBadges.map((b) => `${b.badge.habitId}-${b.badge.type}`));

    const remaining: { habit: Habit; milestone: typeof BADGE_MILESTONES[0]; progress: number }[] = [];
    habits.forEach((habit) => {
      const streak = this.plugin.dataService.getCurrentStreakWithFreeze(habit.id);
      BADGE_MILESTONES.forEach((milestone) => {
        if (!earnedTypes.has(`${habit.id}-${milestone.type}`)) {
          remaining.push({
            habit,
            milestone,
            progress: Math.min(100, (streak / milestone.days) * 100),
          });
        }
      });
    });

    if (remaining.length > 0) {
      const inProgress = container.createDiv({ cls: 'badges-in-progress' });
      inProgress.createEl('h3', { text: 'In Progress' });

      const progressGrid = inProgress.createDiv({ cls: 'badge-grid' });
      remaining.sort((a, b) => b.progress - a.progress).slice(0, 8).forEach(({ habit, milestone, progress }) => {
        const badgeEl = progressGrid.createDiv({ cls: 'badge-item in-progress' });
        badgeEl.createEl('div', { cls: 'badge-emoji', text: milestone.emoji });
        badgeEl.createEl('div', { cls: 'badge-name', text: milestone.label });
        badgeEl.createEl('div', { cls: 'badge-habit', text: (habit.emoji || '') + ' ' + habit.name });

        const progressBar = badgeEl.createDiv({ cls: 'badge-progress-bar' });
        progressBar.createDiv({ cls: 'badge-progress-fill', attr: { style: `width: ${progress}%` } });
        badgeEl.createEl('div', { cls: 'badge-progress-text', text: `${progress.toFixed(0)}%` });
      });
    }
  }

  private showTemplatesModal(): void {
    const modal = this.plugin.app.workspace.containerEl.createDiv({ cls: 'habit-modal-overlay' });

    const dialog = modal.createDiv({ cls: 'habit-modal templates-modal' });
    dialog.createEl('h3', { text: '📦 Habit Templates' });
    dialog.createEl('p', { cls: 'modal-subtitle', text: 'Start with a pre-built habit stack' });

    const templateList = dialog.createDiv({ cls: 'template-list' });

    Object.entries(HABIT_TEMPLATES).forEach(([key, template]) => {
      const item = templateList.createDiv({ cls: 'template-item' });

      const header = item.createDiv({ cls: 'template-header' });
      header.createEl('span', { cls: 'template-name', text: template.name });
      header.createEl('span', { cls: 'template-count', text: `${template.habits.length} habits` });

      const habits = item.createDiv({ cls: 'template-habits' });
      template.habits.forEach((h) => {
        habits.createEl('span', { cls: 'template-habit', text: `${h.emoji} ${h.name}` });
      });

      const installBtn = item.createEl('button', { cls: 'btn-primary', text: 'Install' });
      installBtn.addEventListener('click', async () => {
        // Create category for the template
        const category = await this.plugin.dataService.addCategory(
          template.name.replace(/[^\w\s]/g, '').trim(),
          undefined,
          template.name.split(' ')[0]
        );

        // Create habits
        for (const h of template.habits) {
          await this.plugin.dataService.addHabit(h.name, 'daily', {
            emoji: h.emoji,
            categoryId: category.id,
          });
        }

        modal.remove();
        this.render();
        new Notice(`Installed ${template.name} with ${template.habits.length} habits!`);
      });
    });

    const closeBtn = dialog.createEl('button', { cls: 'btn-secondary close-btn', text: 'Close' });
    closeBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private showAddHabitModal(): void {
    const modal = this.plugin.app.workspace.containerEl.createDiv({ cls: 'habit-modal-overlay' });

    const dialog = modal.createDiv({ cls: 'habit-modal' });
    dialog.createEl('h3', { text: 'New Habit' });

    const form = dialog.createEl('form');

    // Name input
    const nameGroup = form.createDiv({ cls: 'form-group' });
    nameGroup.createEl('label', { text: 'Habit name' });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      placeholder: 'e.g., Exercise, Read, Meditate',
    });

    // Emoji input
    const emojiGroup = form.createDiv({ cls: 'form-group' });
    emojiGroup.createEl('label', { text: 'Emoji (optional)' });
    const emojiInput = emojiGroup.createEl('input', {
      type: 'text',
      placeholder: 'e.g., 🏃 📚 🧘',
    });

    // Category select
    const categories = this.plugin.dataService.getCategories();
    const categoryGroup = form.createDiv({ cls: 'form-group' });
    categoryGroup.createEl('label', { text: 'Category (optional)' });
    const categorySelect = categoryGroup.createEl('select');
    categorySelect.createEl('option', { value: '', text: 'No category' });
    categories.forEach((cat) => {
      categorySelect.createEl('option', { value: cat.id, text: (cat.emoji || '') + ' ' + cat.name });
    });

    // Add new category - inline input
    const newCatContainer = categoryGroup.createDiv({ cls: 'new-category-container' });
    const newCatBtn = newCatContainer.createEl('button', { type: 'button', cls: 'btn-link', text: '+ New Category' });
    const newCatInputRow = newCatContainer.createDiv({ cls: 'new-category-input-row hidden' });
    const newCatInput = newCatInputRow.createEl('input', { type: 'text', placeholder: 'Category name' });
    const newCatSaveBtn = newCatInputRow.createEl('button', { type: 'button', cls: 'btn btn-small', text: 'Add' });
    const newCatCancelBtn = newCatInputRow.createEl('button', { type: 'button', cls: 'btn btn-small btn-secondary', text: 'Cancel' });

    newCatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      newCatBtn.addClass('hidden');
      newCatInputRow.removeClass('hidden');
      newCatInput.focus();
    });

    newCatCancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      newCatInputRow.addClass('hidden');
      newCatBtn.removeClass('hidden');
      newCatInput.value = '';
    });

    const saveNewCategory = async () => {
      const name = newCatInput.value.trim();
      if (name) {
        const cat = await this.plugin.dataService.addCategory(name);
        categorySelect.createEl('option', { value: cat.id, text: cat.name });
        categorySelect.value = cat.id;
        newCatInput.value = '';
        newCatInputRow.addClass('hidden');
        newCatBtn.removeClass('hidden');
      }
    };

    newCatSaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveNewCategory();
    });

    newCatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        saveNewCategory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        newCatInputRow.addClass('hidden');
        newCatBtn.removeClass('hidden');
        newCatInput.value = '';
      }
    });

    // Frequency select
    const freqGroup = form.createDiv({ cls: 'form-group' });
    freqGroup.createEl('label', { text: 'Frequency' });
    const freqSelect = freqGroup.createEl('select');
    freqSelect.createEl('option', { value: 'daily', text: 'Daily' });
    freqSelect.createEl('option', { value: 'weekly', text: 'Weekly' });
    freqSelect.createEl('option', { value: 'custom', text: 'Custom days' });

    // Custom days
    const customDaysGroup = form.createDiv({ cls: 'form-group custom-days hidden' });
    customDaysGroup.createEl('label', { text: 'Select days' });
    const daysContainer = customDaysGroup.createDiv({ cls: 'days-selector' });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const selectedDays: number[] = [];

    days.forEach((day, index) => {
      const dayBtn = daysContainer.createEl('button', { type: 'button', cls: 'day-btn', text: day });
      dayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedDays.includes(index)) {
          selectedDays.splice(selectedDays.indexOf(index), 1);
          dayBtn.removeClass('active');
        } else {
          selectedDays.push(index);
          dayBtn.addClass('active');
        }
      });
    });

    freqSelect.addEventListener('change', () => {
      if (freqSelect.value === 'custom' || freqSelect.value === 'weekly') {
        customDaysGroup.removeClass('hidden');
      } else {
        customDaysGroup.addClass('hidden');
      }
    });

    // Goal setting
    const goalGroup = form.createDiv({ cls: 'form-group' });
    goalGroup.createEl('label', { text: 'Goal (optional)' });
    const goalSelect = goalGroup.createEl('select');
    goalSelect.createEl('option', { value: '', text: 'No goal' });
    goalSelect.createEl('option', { value: '7', text: '🔥 7-day streak' });
    goalSelect.createEl('option', { value: '30', text: '⭐ 30-day streak' });
    goalSelect.createEl('option', { value: '100', text: '💎 100-day streak' });
    goalSelect.createEl('option', { value: '365', text: '👑 365-day streak' });

    // Buttons
    const buttons = form.createDiv({ cls: 'form-buttons' });
    const cancelBtn = buttons.createEl('button', { type: 'button', cls: 'btn-secondary', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => modal.remove());

    buttons.createEl('button', { type: 'submit', cls: 'btn-primary', text: 'Create Habit' });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        new Notice('Please enter a habit name');
        return;
      }

      await this.plugin.dataService.addHabit(
        name,
        freqSelect.value as 'daily' | 'weekly' | 'custom',
        {
          emoji: emojiInput.value.trim() || undefined,
          customDays: selectedDays.length > 0 ? selectedDays : undefined,
          categoryId: categorySelect.value || undefined,
          goalDays: goalSelect.value ? parseInt(goalSelect.value) : undefined,
        }
      );

      modal.remove();
      this.render();
      this.plugin.updateStatusBar();
      new Notice(`Habit "${name}" created!`);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    nameInput.focus();
  }

  private showHabitMenu(event: MouseEvent, habit: Habit): void {
    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle('Edit').setIcon('pencil').onClick(() => this.showEditHabitModal(habit))
    );

    // Category submenu
    const categories = this.plugin.dataService.getCategories();
    if (categories.length > 0) {
      menu.addItem((item) =>
        item.setTitle('Move to Category').setIcon('folder').onClick(() => {
          const catMenu = new Menu();
          catMenu.addItem((i) => i.setTitle('No category').onClick(async () => {
            await this.plugin.dataService.updateHabit(habit.id, { categoryId: undefined });
            this.render();
          }));
          categories.forEach((cat) => {
            catMenu.addItem((i) => i.setTitle((cat.emoji || '') + ' ' + cat.name).onClick(async () => {
              await this.plugin.dataService.updateHabit(habit.id, { categoryId: cat.id });
              this.render();
            }));
          });
          catMenu.showAtMouseEvent(event);
        })
      );
    }

    menu.addItem((item) =>
      item.setTitle('Archive').setIcon('archive').onClick(async () => {
        await this.plugin.dataService.archiveHabit(habit.id);
        this.render();
        new Notice(`"${habit.name}" archived`);
      })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item.setTitle('Delete').setIcon('trash').onClick(async () => {
        if (confirm(`Delete "${habit.name}"? This cannot be undone.`)) {
          await this.plugin.dataService.deleteHabit(habit.id);
          this.render();
          this.plugin.updateStatusBar();
          new Notice(`"${habit.name}" deleted`);
        }
      })
    );

    menu.showAtMouseEvent(event);
  }

  private showEditHabitModal(habit: Habit): void {
    const modal = this.plugin.app.workspace.containerEl.createDiv({ cls: 'habit-modal-overlay' });

    const dialog = modal.createDiv({ cls: 'habit-modal' });
    dialog.createEl('h3', { text: 'Edit Habit' });

    const form = dialog.createEl('form');

    // Name
    const nameGroup = form.createDiv({ cls: 'form-group' });
    nameGroup.createEl('label', { text: 'Habit name' });
    const nameInput = nameGroup.createEl('input', { type: 'text', value: habit.name });

    // Emoji
    const emojiGroup = form.createDiv({ cls: 'form-group' });
    emojiGroup.createEl('label', { text: 'Emoji' });
    const emojiInput = emojiGroup.createEl('input', { type: 'text', value: habit.emoji || '' });

    // Category
    const categories = this.plugin.dataService.getCategories();
    const categoryGroup = form.createDiv({ cls: 'form-group' });
    categoryGroup.createEl('label', { text: 'Category' });
    const categorySelect = categoryGroup.createEl('select');
    categorySelect.createEl('option', { value: '', text: 'No category' });
    categories.forEach((cat) => {
      const opt = categorySelect.createEl('option', { value: cat.id, text: (cat.emoji || '') + ' ' + cat.name });
      if (habit.categoryId === cat.id) opt.selected = true;
    });

    // Goal
    const goalGroup = form.createDiv({ cls: 'form-group' });
    goalGroup.createEl('label', { text: 'Goal' });
    const goalSelect = goalGroup.createEl('select');
    goalSelect.createEl('option', { value: '', text: 'No goal' });
    [7, 30, 100, 365].forEach((days) => {
      const opt = goalSelect.createEl('option', { value: String(days), text: `${days}-day streak` });
      if (habit.goalDays === days) opt.selected = true;
    });

    // Buttons
    const buttons = form.createDiv({ cls: 'form-buttons' });
    const cancelBtn = buttons.createEl('button', { type: 'button', cls: 'btn-secondary', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => modal.remove());

    buttons.createEl('button', { type: 'submit', cls: 'btn-primary', text: 'Save Changes' });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        new Notice('Please enter a habit name');
        return;
      }

      await this.plugin.dataService.updateHabit(habit.id, {
        name,
        emoji: emojiInput.value.trim() || undefined,
        categoryId: categorySelect.value || undefined,
        goalDays: goalSelect.value ? parseInt(goalSelect.value) : undefined,
      });

      modal.remove();
      this.render();
      new Notice('Habit updated!');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    nameInput.focus();
  }
}
