"""Pytest configuration and fixtures."""
import os
import sys
from pathlib import Path

# Add backend to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Ensure we're in backend dir for imports
os.chdir(Path(__file__).resolve().parent.parent)
