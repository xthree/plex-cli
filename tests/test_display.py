"""Tests for display helper functions."""

from __future__ import annotations

import pytest

from plex_cli.display import fmt_duration, fmt_type, fmt_watched, fmt_year


@pytest.mark.parametrize(
    "ms,expected",
    [
        (None, "--:--"),
        (0, "0:00"),
        (60_000, "1:00"),
        (3661_000, "1:01:01"),
        (5_400_000, "1:30:00"),
    ],
)
def test_fmt_duration(ms, expected):
    assert fmt_duration(ms) == expected


@pytest.mark.parametrize(
    "item,expected",
    [
        ({"year": 2020}, "2020"),
        ({"year": None, "parentYear": 2019}, "2019"),
        ({}, ""),
    ],
)
def test_fmt_year(item, expected):
    assert fmt_year(item) == expected


def test_fmt_type_known():
    assert fmt_type({"type": "movie"}) == "🎬 Movie"
    assert fmt_type({"type": "show"}) == "📺 Show"
    assert fmt_type({"type": "track"}) == "🎵 Track"


def test_fmt_type_unknown():
    result = fmt_type({"type": "funky"})
    assert "Funky" in result


def test_fmt_watched_unwatched():
    assert fmt_watched({"viewCount": 0}) == ""


def test_fmt_watched_watched():
    assert fmt_watched({"viewCount": 3}) == "✓"


def test_fmt_watched_in_progress():
    assert fmt_watched({"viewCount": 0, "viewOffset": 5000}) == "▶"
