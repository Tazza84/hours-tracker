# Hours Tracker PWA

A modern, responsive Progressive Web App for tracking work hours with overtime banking, built specifically for flexible schedules and international teams.

## Features

- ⏱️ **Smart Timer System**: Start/pause/stop with persistent sessions
- 📊 **Weekly Balance Tracking**: See if you're ahead or behind your target
- 💰 **Overtime Banking**: Accumulate and use banked hours
- 📋 **Official Time Accrual**: Log hours for your work system
- 🍽️ **Auto Lunch Breaks**: 30-minute automatic break with resume
- 📱 **PWA Support**: Install on mobile/desktop, works offline
- 🎨 **Beautiful UI**: Soft pastel design with smooth animations

## Target User

Perfect for employees who:
- Have irregular schedules (7.6 hours/day target)
- Work across time zones with late meetings
- Need to track overtime for time-off banking
- Want to balance work hours over weekly/fortnightly periods

## Quick Start

1. Clone or download the files
2. Open `index.html` in a browser to test locally
3. Deploy to Cloudflare Pages for production

## Deployment to Cloudflare Pages

### Option 1: GitHub Integration (Recommended)

1. **Create GitHub Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/hours-tracker.git
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to Pages > Create a project
   - Connect your GitHub account
   - Select your hours-tracker repository
   - Configure build settings:
     - Framework preset: None
     - Build command: (leave empty)
     - Build output directory: `/`
   - Click "Save and Deploy"

3. **Custom Domain (Optional)**:
   - In Pages settings, add your custom domain
   - Update DNS settings as instructed

### Option 2: Direct Upload

1. **Upload Files**:
   - Go to Cloudflare Pages
   - Choose "Upload assets"
   - Drag and drop all files
   - Click "Deploy site"

### Environment Variables

No environment variables needed for basic functionality. When adding backend features (Cloudflare D1, Workers), you'll need:

```
DATABASE_URL=your-d1-database-url
API_BASE_URL=your-workers-api-url
```

## File Structure

```
hours-tracker/
├── index.html          # Main app interface
├── app.js             # Core application logic
├── sw.js              # Service worker for PWA
├── manifest.json      # PWA manifest
└── README.md          # This file
```

## Core Functionality

### Timer System
- **Start/Pause/Resume**: Full timer control with persistent state
- **Session Tracking**: Automatic saving of work sessions
- **Real-time Updates**: Live progress display while running

### Overtime Banking
- **Automatic Calculation**: Tracks hours over 7.6/day target
- **Two Usage Types**:
  - Official time accrual (removes from bank)
  - Casual use (early leave, long lunch)
- **Balance Display**: Always visible current bank balance

### Progress Tracking
- **Circular Progress Rings**: Visual weekly and daily progress
- **Weekly Summaries**: Fortnightly focus with daily breakdowns
- **Historical Data**: View patterns over time

### PWA Features
- **Installable**: Add to home screen on mobile/desktop
- **Offline Capable**: Works without internet connection
- **Push Notifications**: Timer alerts and reminders
- **Background Sync**: Syncs data when connection returns

## Customization

### Colors & Theme
Edit CSS variables in `index.html`:
```css
:root {
  --bg-gradient-green: linear-gradient(135deg, #67e8f9 0%, #84cc16 100%);
  --bg-gradient-blue: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  /* ... more variables */
}
```

### Default Settings
Modify in `app.js`:
```javascript
this.targetHours = 7.6; // Daily target
this.weeklyBalance = 3.2; // Current balance
this.bankedHours = 15.7; // Total banked
```

### Lunch Duration
Change default in the settings modal or modify the timer logic.

## Future Enhancements

### Backend Integration (Cloudflare Stack)
- **Cloudflare D1**: SQLite database for persistent storage
- **Cloudflare Workers**: API endpoints for data operations
- **Multi-device Sync**: Share data across devices

### Advanced Features
- **Team Integration**: Share with colleagues
- **Reporting**: Export time data
- **Calendar Sync**: Integration with work calendars
- **Smart Notifications**: Context-aware reminders

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers with PWA support

## Development

### Local Testing
1. Use a local server (not file://) for full PWA features:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx serve .
   ```

2. Open http://localhost:8000

### PWA Testing
- Use Chrome DevTools > Application tab
- Test service worker, manifest, and offline functionality
- Use Lighthouse for PWA audit

## License

MIT License - feel free to modify and distribute.

## Support

This is a custom-built solution. For modifications or issues:
1. Check browser console for errors
2. Test in different browsers
3. Verify PWA features in Chrome DevTools

Built with ❤️ for flexible work schedules and better work-life balance.
