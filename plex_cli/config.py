"""Configuration management for plex-cli.

Settings are persisted in ``~/.config/plex-cli/config.json``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

_CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "plex-cli"
_CONFIG_FILE = _CONFIG_DIR / "config.json"


def _load_raw() -> dict[str, Any]:
    if _CONFIG_FILE.exists():
        try:
            return json.loads(_CONFIG_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_raw(data: dict[str, Any]) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(json.dumps(data, indent=2))


class Config:
    """Read/write access to persisted configuration."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = _load_raw()

    # ------------------------------------------------------------------
    # Profiles
    # ------------------------------------------------------------------

    def list_profiles(self) -> list[str]:
        return list(self._data.get("profiles", {}).keys())

    def get_profile(self, name: str) -> dict[str, Any] | None:
        return self._data.get("profiles", {}).get(name)

    def save_profile(self, name: str, url: str, token: str) -> None:
        self._data.setdefault("profiles", {})[name] = {"url": url, "token": token}
        if not self._data.get("default_profile"):
            self._data["default_profile"] = name
        _save_raw(self._data)

    def delete_profile(self, name: str) -> None:
        profiles = self._data.get("profiles", {})
        profiles.pop(name, None)
        if self._data.get("default_profile") == name:
            self._data["default_profile"] = next(iter(profiles), None)
        _save_raw(self._data)

    def set_default_profile(self, name: str) -> None:
        self._data["default_profile"] = name
        _save_raw(self._data)

    @property
    def default_profile(self) -> str | None:
        return self._data.get("default_profile")

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def active_profile(self) -> dict[str, Any] | None:
        name = self.default_profile
        if name:
            return self.get_profile(name)
        return None
