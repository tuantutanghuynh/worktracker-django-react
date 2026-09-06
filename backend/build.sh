#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> [1/3] Installing Python dependencies..."
pip install -r requirements.txt

echo "==> [2/3] Collecting static files for WhiteNoise..."
python manage.py collectstatic --no-input

echo "==> [3/4] Running Database Migrations..."
python manage.py migrate --no-input

echo "==> [4/4] Seeding Master Enterprise Dataset..."
python manage.py seed_data || echo "Seed completed or skipped"

echo "==> Build completed successfully!"