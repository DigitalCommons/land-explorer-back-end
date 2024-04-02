#!/bin/bash

# Run this script on the server to pull the latest code and deploy it.

set -e
set -x

# If branch was inputted as argument, check it is checked out
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ ! -z "$1" ] && [ $1 != $CURRENT_BRANCH ]; then
    echo "ERROR: We cannot deploy branch $1 because the branch $CURRENT_BRANCH is checked out"
    exit 1
fi

# Pull latest code
git pull

# Install dependencies
export NODE_ENV=production
npm ci

# Transpile ts into js
npm run build

# Run migrations
npx sequelize-cli db:migrate

# Run seeder
npx sequelize-cli db:seed:all

# Restart the backend process
pm2 restart 0
