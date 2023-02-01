#!/bin/bash
set -e
set -x

# Pull latest code
git pull

# Transpile ts into js
npm run build

# Run migrations
npx sequelize-cli db:migrate

# Run seeder
npx sequelize-cli db:seed:all

# Restart the backend process
pm2 restart 0
