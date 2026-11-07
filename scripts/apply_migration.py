#!/usr/bin/env python3
"""Applies migration files to the real project: scripts/apply_migration.py FILE..."""
import pathlib
import sys

from db import sql

for path in sys.argv[1:]:
    sql(pathlib.Path(path).read_text())
    print('applied', path)
