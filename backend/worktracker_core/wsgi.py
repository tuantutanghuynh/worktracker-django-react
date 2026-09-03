"""
Module: worktracker_core.wsgi
Description: WSGI configuration exposing the WSGI callable for traditional HTTP web servers.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worktracker_core.settings')

application = get_wsgi_application()
