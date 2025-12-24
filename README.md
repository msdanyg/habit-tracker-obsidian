# Habit Tracker Pro for Obsidian

Build lasting habits with streaks, badges, and beautiful analytics - all inside Obsidian.

## Features

### Core Features
- **Daily Check-ins**: Simple interface to mark habits complete each day
- **Streak Tracking**: See current and longest streaks for motivation
- **Calendar Heatmap**: Visualize your consistency over time
- **Analytics Dashboard**: View completion rates and trends (7/30/90 days)
- **Flexible Scheduling**: Daily, weekly, or custom day habits
- **Status Bar Progress**: See today's progress at a glance
- **Data Export/Import**: Backup and restore your habit data

### Premium Features

**Achievements & Badges**
Earn badges as you hit milestones:
- First Week (7 days)
- Monthly Master (30 days)
- Century Club (100 days)
- Year Champion (365 days)

**Streak Protection**
Freeze days let you take planned breaks (vacation, sick days) without losing your streak.

**One-Click Habit Templates**
Get started instantly with pre-built habit stacks:
- Morning Routine
- Fitness & Health
- Productivity
- Mindfulness
- Learning

**Categories & Organization**
Color-coded categories keep your habits organized. Filter by category to focus on what matters.

**Celebration Animations**
Confetti bursts when you complete habits. Special animations when you earn badges.

**Visual Progress**
SVG progress rings show your journey to the next milestone. Day-of-week performance charts reveal your strongest days.

## Installation

### Manual Installation (from Gumroad purchase)
1. Download the ZIP file from your Gumroad purchase
2. Create a folder called `habit-tracker` in your vault's `.obsidian/plugins/` directory
3. Extract these files into the folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Open Obsidian Settings > Community Plugins
5. Turn off "Restricted Mode" if prompted
6. Find "Habit Tracker Pro" in the list and enable it

### Folder Structure
Your plugin folder should look like:
```
YourVault/
└── .obsidian/
    └── plugins/
        └── habit-tracker/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

## Usage

1. Click the checkmark icon in the left ribbon or use the command palette (`Ctrl/Cmd + P`, then search "Habit Tracker")
2. Add your first habit with the "+ New Habit" button
3. Or click "+ Templates" to install a pre-built habit stack
4. Check off habits as you complete them each day
5. View your progress in the Calendar, Stats, and Badges tabs

### Tabs Overview
- **Today**: Your daily habit checklist with progress rings
- **Calendar**: Monthly heatmap view of completions
- **Stats**: Analytics and day-of-week performance charts
- **Badges**: Your achievement gallery and milestone progress

### Keyboard Shortcuts
- `Ctrl/Cmd + Shift + H`: Open Habit Tracker
- Right-click any habit for edit/archive/delete options

### Freeze Days
Click "Freeze Today" to protect your streak on days you can't complete habits (vacation, sick days, etc.). Frozen days show with a snowflake icon in the calendar.

## Data Storage

All habit data is stored locally in your vault's plugin data folder (`data.json`). No data is sent to external servers. Your data stays private.

## Requirements

- Obsidian v1.0.0 or higher
- Works on desktop (Windows, Mac, Linux)

## Support

- Questions or issues? Email: [YOUR_EMAIL]
- Updates and announcements: [YOUR_TWITTER_OR_WEBSITE]

## License

This plugin is sold under a personal use license. You may use it on unlimited personal devices. Redistribution is not permitted.

---

Thank you for supporting independent plugin development!
