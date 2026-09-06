#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> [1/3] Installing Python dependencies..."
pip install -r requirements.txt

echo "==> [2/3] Collecting static files for WhiteNoise..."
python manage.py collectstatic --no-input

echo "==> [3/3] Running Database Migrations..."
python manage.py migrate --no-input

echo "==> Build completed successfully!"