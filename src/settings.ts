import { App, PluginSettingTab, Setting } from 'obsidian';
import HabitTrackerPlugin from '../main';

export interface HabitTrackerSettings {
  showInStatusBar: boolean;
  defaultView: 'today' | 'calendar' | 'stats';
  weekStartsOn: 0 | 1 | 6; // 0 = Sunday, 1 = Monday, 6 = Saturday
  enableDailyNoteIntegration: boolean;
  dailyNoteFormat: string;
  showStreakNotifications: boolean;
}

export const DEFAULT_SETTINGS: HabitTrackerSettings = {
  showInStatusBar: true,
  defaultView: 'today',
  weekStartsOn: 0,
  enableDailyNoteIntegration: false,
  dailyNoteFormat: '## Habits\n{{habits}}',
  showStreakNotifications: true,
};

export class HabitTrackerSettingTab extends PluginSettingTab {
  plugin: HabitTrackerPlugin;

  constructor(app: App, plugin: HabitTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Habit Tracker Settings' });

    // Display settings
    new Setting(containerEl)
      .setName('Show in status bar')
      .setDesc('Display today\'s habit progress in the status bar')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInStatusBar)
          .onChange(async (value) => {
            this.plugin.settings.showInStatusBar = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
          })
      );

    new Setting(containerEl)
      .setName('Default view')
      .setDesc('Which view to show when opening the habit tracker')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('today', 'Today')
          .addOption('calendar', 'Calendar')
          .addOption('stats', 'Statistics')
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value: 'today' | 'calendar' | 'stats') => {
            this.plugin.settings.defaultView = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Week starts on')
      .setDesc('First day of the week for calendar views')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('0', 'Sunday')
          .addOption('1', 'Monday')
          .addOption('6', 'Saturday')
          .setValue(String(this.plugin.settings.weekStartsOn))
          .onChange(async (value) => {
            this.plugin.settings.weekStartsOn = parseInt(value) as 0 | 1 | 6;
            await this.plugin.saveSettings();
          })
      );

    // Notifications
    containerEl.createEl('h3', { text: 'Notifications' });

    new Setting(containerEl)
      .setName('Streak notifications')
      .setDesc('Show notifications for streak milestones (7, 30, 100 days)')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showStreakNotifications)
          .onChange(async (value) => {
            this.plugin.settings.showStreakNotifications = value;
            await this.plugin.saveSettings();
          })
      );

    // Daily note integration
    containerEl.createEl('h3', { text: 'Daily Note Integration' });

    new Setting(containerEl)
      .setName('Enable daily note integration')
      .setDesc('Automatically add habit status to your daily notes')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDailyNoteIntegration)
          .onChange(async (value) => {
            this.plugin.settings.enableDailyNoteIntegration = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Daily note format')
      .setDesc('Template for habit status in daily notes. Use {{habits}} as placeholder.')
      .addTextArea((text) =>
        text
          .setPlaceholder('## Habits\n{{habits}}')
          .setValue(this.plugin.settings.dailyNoteFormat)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteFormat = value;
            await this.plugin.saveSettings();
          })
      );

    // Data management
    containerEl.createEl('h3', { text: 'Data Management' });

    new Setting(containerEl)
      .setName('Export data')
      .setDesc('Download all your habit data as JSON')
      .addButton((button) =>
        button.setButtonText('Export').onClick(() => {
          const data = this.plugin.dataService.exportData();
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        })
      );

    new Setting(containerEl)
      .setName('Import data')
      .setDesc('Restore habit data from a JSON backup (this will replace current data)')
      .addButton((button) =>
        button.setButtonText('Import').onClick(() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
              const text = await file.text();
              const success = await this.plugin.dataService.importData(text);
              if (success) {
                this.plugin.refreshViews();
              }
            }
          };
          input.click();
        })
      );
  }
}
