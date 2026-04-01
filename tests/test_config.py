"""Tests for configuration management."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

import plex_cli.config as cfg_module
from plex_cli.config import Config


@pytest.fixture(autouse=True)
def _tmp_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirect config file writes to a temporary directory."""
    monkeypatch.setattr(cfg_module, "_CONFIG_DIR", tmp_path / "plex-cli")
    monkeypatch.setattr(cfg_module, "_CONFIG_FILE", tmp_path / "plex-cli" / "config.json")


def test_empty_config() -> None:
    c = Config()
    assert c.list_profiles() == []
    assert c.default_profile is None
    assert c.active_profile() is None


def test_save_and_get_profile() -> None:
    c = Config()
    c.save_profile("home", "http://192.168.1.10:32400", "abc123")
    profile = c.get_profile("home")
    assert profile is not None
    assert profile["url"] == "http://192.168.1.10:32400"
    assert profile["token"] == "abc123"


def test_first_saved_profile_becomes_default() -> None:
    c = Config()
    c.save_profile("home", "http://192.168.1.10:32400", "abc123")
    assert c.default_profile == "home"


def test_list_profiles() -> None:
    c = Config()
    c.save_profile("home", "http://host1:32400", "tok1")
    c.save_profile("work", "http://host2:32400", "tok2")
    profiles = c.list_profiles()
    assert "home" in profiles
    assert "work" in profiles


def test_set_default_profile() -> None:
    c = Config()
    c.save_profile("home", "http://host1:32400", "tok1")
    c.save_profile("work", "http://host2:32400", "tok2")
    c.set_default_profile("work")
    assert c.default_profile == "work"
    assert c.active_profile()["url"] == "http://host2:32400"


def test_delete_profile() -> None:
    c = Config()
    c.save_profile("home", "http://host1:32400", "tok1")
    c.save_profile("work", "http://host2:32400", "tok2")
    c.delete_profile("home")
    assert "home" not in c.list_profiles()
    assert "work" in c.list_profiles()


def test_delete_default_profile_updates_default() -> None:
    c = Config()
    c.save_profile("home", "http://host1:32400", "tok1")
    c.save_profile("work", "http://host2:32400", "tok2")
    c.set_default_profile("home")
    c.delete_profile("home")
    # Default should shift to the remaining profile
    assert c.default_profile != "home"


def test_persistence(tmp_path: Path) -> None:
    """Profiles should persist across Config instances."""
    config_dir = tmp_path / "plex-cli"
    config_file = config_dir / "config.json"

    import plex_cli.config as cfg_module_local

    # Monkeypatch within this test only
    original_dir = cfg_module_local._CONFIG_DIR
    original_file = cfg_module_local._CONFIG_FILE
    cfg_module_local._CONFIG_DIR = config_dir
    cfg_module_local._CONFIG_FILE = config_file

    try:
        c1 = Config()
        c1.save_profile("home", "http://host:32400", "tok")

        c2 = Config()
        assert "home" in c2.list_profiles()
        assert c2.get_profile("home")["token"] == "tok"
    finally:
        cfg_module_local._CONFIG_DIR = original_dir
        cfg_module_local._CONFIG_FILE = original_file


def test_get_nonexistent_profile() -> None:
    c = Config()
    assert c.get_profile("nonexistent") is None
