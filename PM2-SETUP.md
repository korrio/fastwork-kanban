# PM2 Setup Guide for Fastwork Job Bot

PM2 is a production process manager for Node.js applications that provides automatic restarts, monitoring, and logging.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start All Services
```bash
npm run pm2:start
```

### 3. Check Status
```bash
npm run pm2:status
```

### 4. View Logs
```bash
npm run pm2:logs
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run pm2:start` | Start both server and cron processes |
| `npm run pm2:stop` | Stop all processes |
| `npm run pm2:restart` | Restart all processes |
| `npm run pm2:delete` | Delete all processes |
| `npm run pm2:status` | Show process status |
| `npm run pm2:logs` | Show real-time logs |
| `npm run pm2:cron` | Start only cron job |
| `npm run pm2:server` | Start only web server |
| `npm run pm2:monit` | Open PM2 monitoring dashboard |

## 🔧 Process Management

### Individual Process Control
```bash
# Start only cron job
npm run pm2:cron

# Start only web server  
npm run pm2:server

# Stop specific process
pm2 stop fastwork-cron
pm2 stop fastwork-server

# Restart specific process
pm2 restart fastwork-cron
pm2 restart fastwork-server
```

### Monitoring
```bash
# Real-time monitoring dashboard
npm run pm2:monit

# Process list with CPU/Memory usage
pm2 list

# Detailed process info
pm2 describe fastwork-cron
```

## 📊 Logs and Debugging

### Log Locations
- **Application logs**: `./logs/fastwork-api.log`
- **PM2 cron logs**: `./logs/pm2-cron-combined.log`
- **PM2 server logs**: `./logs/pm2-server-combined.log`
- **Error logs**: `./logs/pm2-*-error.log`

### Log Commands
```bash
# Show all logs
pm2 logs

# Show specific process logs
pm2 logs fastwork-cron
pm2 logs fastwork-server

# Show last 100 lines
pm2 logs --lines 100

# Follow logs in real-time
pm2 logs --raw
```

## 🔄 Auto-Startup (Optional)

To automatically start processes on system boot:

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

## 🛠 Configuration

The PM2 configuration is in `ecosystem.config.js`:

```javascript
{
  name: 'fastwork-cron',
  script: 'src/cron/index.js',
  instances: 1,
  autorestart: true,
  max_memory_restart: '200M',
  // ... other options
}
```

## 🚨 Troubleshooting

### Common Issues

1. **PM2 not found**: Install globally with `npm install -g pm2`

2. **Process won't start**: Check logs with `pm2 logs fastwork-cron`

3. **Memory issues**: Adjust `max_memory_restart` in ecosystem.config.js

4. **Database locked**: Stop all processes with `pm2 delete all` then restart

### Useful Commands
```bash
# Kill all PM2 processes
pm2 kill

# Reload ecosystem config
pm2 reload ecosystem.config.js

# Show PM2 version
pm2 --version

# Update PM2
npm install -g pm2@latest
```

## 📈 Benefits over Regular Cron

- ✅ **Auto-restart** on crashes
- ✅ **Memory monitoring** and restart
- ✅ **Centralized logging**
- ✅ **Process monitoring**
- ✅ **Zero-downtime deployments**
- ✅ **Startup scripts** for system boot
- ✅ **Resource usage tracking**
- ✅ **Load balancing** (if needed)

## 🎯 Production Recommendations

1. **Use PM2 clustering** for the web server if needed
2. **Set up log rotation** to prevent disk space issues
3. **Configure monitoring alerts** 
4. **Use PM2 Plus** for advanced monitoring (optional)
5. **Set up automatic startup** on server boot

---

**Next Steps**: Run `npm run pm2:start` and visit http://localhost:3000 to see your Kanban board!