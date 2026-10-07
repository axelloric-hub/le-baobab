#!/usr/bin/env python
"""Verification autonome de la couche data : python scripts/check_databases.py  (code retour 1 si un controle echoue)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django  # noqa: E402

django.setup()

from apps.core.verify import verify_all  # noqa: E402

failed = 0
for name, ok, detail in verify_all():
    failed += not ok
    print(f"[{'OK' if ok else 'KO'}] {name}: {detail}")
sys.exit(1 if failed else 0)
