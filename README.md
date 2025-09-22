# Fastwork Job Bot

An automated bot that fetches high-value job listings from 4 Fastwork.co categories, analyzes them using Claude AI, and sends notifications to Facebook groups and Telegram channels.

## Features

- 🔍 Fetches jobs from 4 Fastwork.co categories:
  - **Application Development** (พัฒนาแอปพลิเคชัน)
  - **Web Development** (พัฒนาเว็บไซต์)
  - **IT Solutions** (ไอทีโซลูชั่น)
  - **IoT Work** (งาน IoT)
- 💰 Filters jobs with budget ≥ 10,000 THB
- 🧠 On-demand AI analysis using Claude
- 📊 SQLite database for persistence
- 📋 Drag-and-drop Kanban board with localStorage
- 📢 Notifications to Facebook and Telegram
- 🔄 Duplicate job prevention
- 🏷️ Color-coded category display

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Initialize database:**
   ```bash
   npm run init-db
   ```

## Usage

**Run the bot (command line):**
```bash
npm start
```

**Launch Terminal UI:**
```bash
npm run tui     # Advanced terminal interface (may have compatibility issues)
npm run cli     # Simple CLI interface (recommended alternative)
```

**Test API connections:**
```bash
npm start test
```

**Analyze pending jobs only:**
```bash
npm start analyze
```

**Development mode with auto-restart:**
```bash
npm run dev
```

## Terminal UI Features

The TUI provides an interactive dashboard with:
- 📊 Real-time system status and statistics
- 📋 Job listings with filtering and details
- 🎮 Interactive menus and controls
- 📈 Progress tracking for bot operations
- 📱 Live activity logs
- ⚙️ Configuration status monitoring

**TUI Keyboard Shortcuts:**
- `Tab` - Navigate between panels
- `R` - Run bot execution
- `A` - Analyze pending jobs
- `T` - Test API connections
- `F5` - Refresh data
- `H/?` - Show help
- `Q/Esc` - Quit application

## Environment Variables

Create a `.env` file with:

```env
CLAUDE_API_KEY=your_claude_api_key
FACEBOOK_ACCESS_TOKEN=your_facebook_token
FACEBOOK_GROUP_ID=your_group_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Database Schema

The bot uses SQLite with two main tables:
- `jobs`: Stores job listings and analysis
- `notifications`: Tracks notification status

## Job Processing Flow

1. Fetch jobs from 4 Fastwork API categories
2. Filter by budget (≥10,000 THB)
3. Store in database with category colors (avoid duplicates)
4. **On-demand analysis** with Claude AI (via web interface or CLI)
5. Send notifications to configured platforms
6. Update job status and Kanban position

**Note:** Analysis is now **on-demand only** - jobs are fetched and stored, but analysis must be triggered manually through the web interface or CLI.

## Category Color Coding

Each job category has a distinct color on the Kanban board:
- 🟢 **Application Development** - Green
- 🔵 **Web Development** - Blue  
- 🟣 **IT Solutions** - Purple
- 🟠 **IoT Work** - Orange

## Output

Jobs are saved to `jobs.db` and notifications include:
- Job title and budget
- AI analysis summary
- Link to full job details on Fastwork.co