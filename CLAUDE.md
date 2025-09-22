# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a job bot project that fetches job listings from the Fastwork.co API and performs automated analysis and notifications.

**Core Functionality:**
- Fetches jobs from Fastwork API endpoint: `https://jobboard-api.fastwork.co/api/jobs`
- Filters jobs with budget > 10,000 THB
- Analyzes jobs using Claude API
- Sends notifications to Facebook groups and Telegram
- Links back to Fastwork.co for full job details

**MVP Requirements:**
- Process first 5 jobs meeting budget criteria
- Automated job analysis and pre-analysis summaries
- Multi-platform notifications (Facebook + Telegram)

## Development Commands

**Setup:**
```bash
npm install              # Install dependencies
npm run init-db          # Initialize SQLite database
cp .env.example .env     # Configure environment variables
```

**Running:**
```bash
npm start               # Run the bot once (CLI mode)
npm run cli             # Interactive CLI menu (recommended)
npm run tui             # Advanced Terminal UI (may have compatibility issues)
npm run server          # Launch web-based Kanban board
npm start test          # Test API connections
npm start analyze       # Analyze pending jobs only
npm run dev             # Development mode with auto-restart
```

## Architecture

**Core Components:**
- `src/api/fastwork.js` - Fastwork API client
- `src/services/jobProcessor.js` - Job fetching and filtering
- `src/services/claudeAnalyzer.js` - AI job analysis
- `src/services/notificationService.js` - Facebook/Telegram notifications
- `src/database/` - SQLite schema and initialization

**Data Flow:**
1. Fetch jobs from Fastwork API
2. Filter by budget (≥10,000 THB)
3. Store in SQLite database
4. **On-demand analysis** with Claude API (web interface or CLI)
5. Send notifications to configured platforms

**Important:** Analysis is now on-demand only. The bot fetches and stores jobs but requires manual trigger for Claude analysis via web interface or CLI.

## API Integration

**Fastwork Jobs API:**
- Base URL: `https://jobboard-api.fastwork.co/api/jobs`
- Key parameters: pagination, ordering, filtering by tag_id
- Response contains job listings with budget information

**Required Integrations:**
- Claude API for job analysis
- Facebook Graph API for group posting
- Telegram Bot API for notifications