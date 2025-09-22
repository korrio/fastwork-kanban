module.exports = {
  apps: [
    {
      name: 'fastwork-cron',
      script: './src/cron/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-cron-error.log',
      out_file: './logs/pm2-cron-out.log',
      log_file: './logs/pm2-cron-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000
    },
    {
      name: 'fastwork-server',
      script: './src/server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-server-error.log',
      out_file: './logs/pm2-server-out.log',
      log_file: './logs/pm2-server-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000
    }
  ]
};