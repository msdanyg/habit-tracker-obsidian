import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DataService } from './src/services/DataService';
import { HabitTrackerSettings, DEFAULT_SETTINGS, HabitTrackerSettingTab } from './src/settings';
import { HabitView, HABIT_VIEW_TYPE } from './src/views/HabitView';
import { formatDate, isHabitDueOnDate } from './src/models/Habit';

export default class HabitTrackerPlugin extends Plugin {
  settings: HabitTrackerSettings;
  dataService: DataService;
  private statusBarItem: HTMLElement | null = null;

  async onload(): Promise<void> {
    console.log('Loading Habit Tracker plugin');

    // Initialize data service
    this.dataService = new DataService(this);
    await this.dataService.load();

    // Load settings
    await this.loadSettings();

    // Register view
    this.registerView(HABIT_VIEW_TYPE, (leaf) => new HabitView(leaf, this));

    // Add ribbon icon
    this.addRibbonIcon('check-circle', 'Habit Tracker', () => {
      this.activateView();
    });

    // Add command to open habit tracker
    this.addCommand({
      id: 'open-habit-tracker',
      name: 'Open Habit Tracker',
      callback: () => {
        this.activateView();
      },
    });

    // Add command to toggle today's habits quickly
    this.addCommand({
      id: 'toggle-habit',
      name: 'Quick toggle habit',
      callback: () => {
        this.showQuickToggle();
      },
    });

    // Add status bar item
    if (this.settings.showInStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.updateStatusBar();
    }

    // Add settings tab
    this.addSettingTab(new HabitTrackerSettingTab(this.app, this));

    // Auto-open on startup if configured
    this.app.workspace.onLayoutReady(() => {
      // Check if view already exists
      const existing = this.app.workspace.getLeavesOfType(HABIT_VIEW_TYPE);
      if (existing.length === 0) {
        // Optionally auto-open - disabled by default
        // this.activateView();
      }
    });
  }

  async onunload(): Promise<void> {
    console.log('Unloading Habit Tracker plugin');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(HABIT_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: HABIT_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  updateStatusBar(): void {
    if (!this.statusBarItem) {
      if (this.settings.showInStatusBar) {
        this.statusBarItem = this.addStatusBarItem();
      } else {
        return;
      }
    }

    if (!this.settings.showInStatusBar) {
      this.statusBarItem.remove();
      this.statusBarItem = null;
      return;
    }

    const today = new Date();
    const dateStr = formatDate(today);
    const habits = this.dataService.getHabits();
    const dueToday = habits.filter((h) => isHabitDueOnDate(h, today));
    const completedToday = dueToday.filter((h) => {
      const log = this.dataService.getLog(h.id, dateStr);
      return log?.completed;
    });

    const text =
      dueToday.length > 0
        ? `✓ ${completedToday.length}/${dueToday.length}`
        : '✓ No habits';

    this.statusBarItem.setText(text);
    this.statusBarItem.setAttr(
      'title',
      `Habits: ${completedToday.length} of ${dueToday.length} completed today`
    );

    // Make clickable
    this.statusBarItem.addClass('mod-clickable');
    this.statusBarItem.onClickEvent(() => {
      this.activateView();
    });
  }

  refreshViews(): void {
    const leaves = this.app.workspace.getLeavesOfType(HABIT_VIEW_TYPE);
    leaves.forEach((leaf) => {
      const view = leaf.view as HabitView;
      if (view && view.render) {
        view.render();
      }
    });
    this.updateStatusBar();
  }

  private showQuickToggle(): void {
    const today = new Date();
    const dateStr = formatDate(today);
    const habits = this.dataService.getHabits();
    const dueToday = habits.filter((h) => isHabitDueOnDate(h, today));

    if (dueToday.length === 0) {
      // No habits due today
      return;
    }

    // Find first incomplete habit and toggle it
    const incomplete = dueToday.find((h) => {
      const log = this.dataService.getLog(h.id, dateStr);
      return !log?.completed;
    });

    if (incomplete) {
      this.dataService.toggleHabit(incomplete.id, dateStr).then(() => {
        this.refreshViews();
      });
    }
  }
}
