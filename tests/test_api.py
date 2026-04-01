"""Tests for the Plex API client."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
import responses as resp_lib

from plex_cli.api import PlexAPIError, PlexClient


@pytest.fixture()
def client() -> PlexClient:
    return PlexClient("http://plex.local:32400", "test-token")


# ---------------------------------------------------------------------------
# Helper to register a mock Plex JSON response
# ---------------------------------------------------------------------------


def _json(data: dict) -> str:
    return json.dumps(data)


# ---------------------------------------------------------------------------
# server_info
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_server_info(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/",
        json={"MediaContainer": {"machineIdentifier": "abc123", "friendlyName": "My Plex"}},
    )
    info = client.server_info()
    assert info["machineIdentifier"] == "abc123"
    assert info["friendlyName"] == "My Plex"


@resp_lib.activate
def test_server_info_error(client: PlexClient) -> None:
    resp_lib.add(resp_lib.GET, "http://plex.local:32400/", status=401)
    with pytest.raises(PlexAPIError):
        client.server_info()


# ---------------------------------------------------------------------------
# libraries
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_libraries(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/sections",
        json={
            "MediaContainer": {
                "Directory": [
                    {"key": "1", "title": "Movies", "type": "movie"},
                    {"key": "2", "title": "TV Shows", "type": "show"},
                ]
            }
        },
    )
    libs = client.libraries()
    assert len(libs) == 2
    assert libs[0]["title"] == "Movies"


@resp_lib.activate
def test_libraries_empty(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/sections",
        json={"MediaContainer": {}},
    )
    libs = client.libraries()
    assert libs == []


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_search_returns_metadata(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/search",
        json={
            "MediaContainer": {
                "Metadata": [
                    {"ratingKey": "1", "title": "Inception", "type": "movie"},
                    {"ratingKey": "2", "title": "Interstellar", "type": "movie"},
                ]
            }
        },
    )
    results = client.search("In")
    assert len(results) == 2
    assert results[0]["title"] == "Inception"


@resp_lib.activate
def test_search_hub_format(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/search",
        json={
            "MediaContainer": {
                "Hub": [
                    {
                        "type": "movie",
                        "Metadata": [{"ratingKey": "3", "title": "Tenet", "type": "movie"}],
                    }
                ]
            }
        },
    )
    results = client.search("Tenet")
    assert len(results) == 1
    assert results[0]["title"] == "Tenet"


@resp_lib.activate
def test_search_empty(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/search",
        json={"MediaContainer": {}},
    )
    results = client.search("xyzzy")
    assert results == []


# ---------------------------------------------------------------------------
# metadata / children
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_metadata(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/metadata/42",
        json={"MediaContainer": {"Metadata": [{"ratingKey": "42", "title": "Dune", "type": "movie"}]}},
    )
    meta = client.metadata("42")
    assert meta["title"] == "Dune"


@resp_lib.activate
def test_metadata_not_found(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/metadata/99",
        json={"MediaContainer": {"Metadata": []}},
    )
    meta = client.metadata("99")
    assert meta == {}


@resp_lib.activate
def test_children(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/metadata/10/children",
        json={
            "MediaContainer": {
                "Metadata": [
                    {"ratingKey": "11", "title": "Season 1", "type": "season"},
                ]
            }
        },
    )
    kids = client.children("10")
    assert len(kids) == 1
    assert kids[0]["title"] == "Season 1"


# ---------------------------------------------------------------------------
# on_deck / recently_added / sessions
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_on_deck(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/onDeck",
        json={"MediaContainer": {"Metadata": [{"ratingKey": "5", "title": "Ep 3", "type": "episode"}]}},
    )
    items = client.on_deck()
    assert items[0]["title"] == "Ep 3"


@resp_lib.activate
def test_recently_added(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/library/recentlyAdded",
        json={"MediaContainer": {"Metadata": [{"ratingKey": "7", "title": "New Film"}]}},
    )
    items = client.recently_added()
    assert items[0]["title"] == "New Film"


@resp_lib.activate
def test_sessions(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/status/sessions",
        json={"MediaContainer": {"Metadata": [{"ratingKey": "6", "title": "Playing Movie"}]}},
    )
    ss = client.sessions()
    assert ss[0]["title"] == "Playing Movie"


# ---------------------------------------------------------------------------
# clients
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_clients(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/clients",
        json={"MediaContainer": {"Server": [{"name": "Living Room TV", "address": "192.168.1.50", "port": "32433"}]}},
    )
    result = client.clients()
    assert result[0]["name"] == "Living Room TV"


# ---------------------------------------------------------------------------
# playlists
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_playlists(client: PlexClient) -> None:
    resp_lib.add(
        resp_lib.GET,
        "http://plex.local:32400/playlists",
        json={"MediaContainer": {"Metadata": [{"ratingKey": "20", "title": "Favorites", "leafCount": 5}]}},
    )
    pls = client.playlists()
    assert pls[0]["title"] == "Favorites"


# ---------------------------------------------------------------------------
# mark_watched / mark_unwatched
# ---------------------------------------------------------------------------


@resp_lib.activate
def test_mark_watched(client: PlexClient) -> None:
    resp_lib.add(resp_lib.GET, "http://plex.local:32400/:/scrobble", json={})
    client.mark_watched("42")  # should not raise


@resp_lib.activate
def test_mark_unwatched(client: PlexClient) -> None:
    resp_lib.add(resp_lib.GET, "http://plex.local:32400/:/unscrobble", json={})
    client.mark_unwatched("42")  # should not raise


# ---------------------------------------------------------------------------
# Request failure
# ---------------------------------------------------------------------------


def test_request_exception_raises_api_error(client: PlexClient) -> None:
    import requests

    with patch.object(client._session, "get", side_effect=requests.ConnectionError("refused")):
        with pytest.raises(PlexAPIError, match="Request failed"):
            client.server_info()
