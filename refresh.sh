#!/usr/bin/env bash
cd ~/momo-analysis
git pull origin main
pm2 restart momo-app
