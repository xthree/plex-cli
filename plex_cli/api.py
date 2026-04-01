"""Plex Media Server API client."""

from __future__ import annotations

import urllib.parse
from typing import Any

import requests


class PlexAPIError(Exception):
    """Raised when the Plex API returns an unexpected response."""


class PlexClient:
    """Thin wrapper around the Plex Media Server HTTP API.

    All methods raise :class:`PlexAPIError` on non-2xx responses.
    """

    def __init__(self, base_url: str, token: str, timeout: int = 15) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(
            {
                "X-Plex-Token": token,
                "Accept": "application/json",
                "X-Plex-Client-Identifier": "plex-cli",
                "X-Plex-Product": "plex-cli",
                "X-Plex-Version": "0.1.0",
            }
        )

    # ------------------------------------------------------------------
    # Low-level helpers
    # ------------------------------------------------------------------

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.get(url, params=params, timeout=self.timeout)
        except requests.RequestException as exc:
            raise PlexAPIError(f"Request failed: {exc}") from exc
        if not resp.ok:
            raise PlexAPIError(f"HTTP {resp.status_code} for {url}")
        if resp.content:
            return resp.json()
        return {}

    def _post(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.post(url, params=params, timeout=self.timeout)
        except requests.RequestException as exc:
            raise PlexAPIError(f"Request failed: {exc}") from exc
        if not resp.ok:
            raise PlexAPIError(f"HTTP {resp.status_code} for {url}")
        if resp.content:
            return resp.json()
        return {}

    # ------------------------------------------------------------------
    # Server info
    # ------------------------------------------------------------------

    def server_info(self) -> dict[str, Any]:
        """Return top-level server capabilities/identity."""
        data = self._get("/")
        return data.get("MediaContainer", data)

    # ------------------------------------------------------------------
    # Libraries
    # ------------------------------------------------------------------

    def libraries(self) -> list[dict[str, Any]]:
        """Return a list of library sections."""
        data = self._get("/library/sections")
        return data.get("MediaContainer", {}).get("Directory", [])

    def library_contents(
        self,
        section_key: str,
        sort: str = "titleSort:asc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return items in a library section together with total count."""
        params = {"sort": sort, "X-Plex-Container-Size": limit, "X-Plex-Container-Start": offset}
        data = self._get(f"/library/sections/{section_key}/all", params=params)
        mc = data.get("MediaContainer", {})
        items = []
        for key in ("Metadata", "Video", "Track", "Photo", "Directory"):
            if key in mc:
                items = mc[key]
                break
        total = int(mc.get("totalSize", mc.get("size", len(items))))
        return items, total

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(self, query: str, limit: int = 30) -> list[dict[str, Any]]:
        """Full-text search across all libraries."""
        data = self._get("/search", params={"query": query, "limit": limit})
        mc = data.get("MediaContainer", {})
        results: list[dict[str, Any]] = []
        for key in ("Metadata", "Hub"):
            items = mc.get(key, [])
            if items:
                # Hubs wrap their results in a Metadata list
                if key == "Hub":
                    for hub in items:
                        results.extend(hub.get("Metadata", []))
                else:
                    results.extend(items)
        return results

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    def metadata(self, rating_key: str) -> dict[str, Any]:
        """Return detailed metadata for a single item."""
        data = self._get(f"/library/metadata/{rating_key}")
        items = data.get("MediaContainer", {}).get("Metadata", [])
        return items[0] if items else {}

    def children(self, rating_key: str) -> list[dict[str, Any]]:
        """Return child items (seasons/episodes/tracks)."""
        data = self._get(f"/library/metadata/{rating_key}/children")
        mc = data.get("MediaContainer", {})
        for key in ("Metadata", "Directory"):
            if key in mc:
                return mc[key]
        return []

    # ------------------------------------------------------------------
    # On Deck / Recently Added
    # ------------------------------------------------------------------

    def on_deck(self) -> list[dict[str, Any]]:
        data = self._get("/library/onDeck")
        return data.get("MediaContainer", {}).get("Metadata", [])

    def recently_added(self, limit: int = 30) -> list[dict[str, Any]]:
        data = self._get("/library/recentlyAdded", params={"X-Plex-Container-Size": limit})
        return data.get("MediaContainer", {}).get("Metadata", [])

    # ------------------------------------------------------------------
    # Active sessions
    # ------------------------------------------------------------------

    def sessions(self) -> list[dict[str, Any]]:
        data = self._get("/status/sessions")
        return data.get("MediaContainer", {}).get("Metadata", [])

    # ------------------------------------------------------------------
    # Clients
    # ------------------------------------------------------------------

    def clients(self) -> list[dict[str, Any]]:
        data = self._get("/clients")
        return data.get("MediaContainer", {}).get("Server", [])

    # ------------------------------------------------------------------
    # Playback control (Plex HTTP Player API)
    # ------------------------------------------------------------------

    def _player_url(self, client_address: str, client_port: str) -> str:
        return f"http://{client_address}:{client_port}"

    def play_media(
        self,
        client_address: str,
        client_port: str,
        rating_key: str,
        media_type: str = "video",
    ) -> None:
        """Tell a client to play a media item via its HTTP Player API."""
        key = f"/library/metadata/{rating_key}"
        params = {
            "key": key,
            "offset": 0,
            "machineIdentifier": self._get_server_machine_id(),
            "address": urllib.parse.urlparse(self.base_url).hostname,
            "port": urllib.parse.urlparse(self.base_url).port or 32400,
            "protocol": "http",
            "mediaIndex": 0,
            "directStream": 1,
            "directPlay": 1,
            "X-Plex-Token": self.token,
        }
        url = f"http://{client_address}:{client_port}/player/playback/playMedia"
        try:
            resp = self._session.get(url, params=params, timeout=self.timeout)
        except requests.RequestException as exc:
            raise PlexAPIError(f"Player request failed: {exc}") from exc
        if not resp.ok:
            raise PlexAPIError(f"Player HTTP {resp.status_code}")

    def _get_server_machine_id(self) -> str:
        info = self.server_info()
        return info.get("machineIdentifier", "")

    def player_command(
        self,
        client_address: str,
        client_port: str,
        command: str,
        params: dict[str, Any] | None = None,
    ) -> None:
        """Send a player control command (pause, stop, skipNext, etc.)."""
        url = f"http://{client_address}:{client_port}/player/playback/{command}"
        extra = {"X-Plex-Token": self.token}
        if params:
            extra.update(params)
        try:
            resp = self._session.get(url, params=extra, timeout=self.timeout)
        except requests.RequestException as exc:
            raise PlexAPIError(f"Player command failed: {exc}") from exc
        if not resp.ok:
            raise PlexAPIError(f"Player command HTTP {resp.status_code}")

    def get_timeline(self, client_address: str, client_port: str) -> dict[str, Any]:
        """Poll a client's current playback timeline."""
        url = f"http://{client_address}:{client_port}/player/timeline/poll"
        try:
            resp = self._session.get(
                url,
                params={"wait": 0, "X-Plex-Token": self.token},
                timeout=self.timeout,
            )
        except requests.RequestException:
            return {}
        if not resp.ok:
            return {}
        data = resp.json() if resp.content else {}
        entries = (
            data.get("MediaContainer", {}).get("Timeline", [])
            or data.get("MediaContainer", {}).get("_children", [])
        )
        # Find the playing or paused entry
        for entry in entries:
            if entry.get("state") in ("playing", "paused", "buffering"):
                return entry
        return entries[0] if entries else {}

    # ------------------------------------------------------------------
    # Scrobbling
    # ------------------------------------------------------------------

    def mark_watched(self, rating_key: str) -> None:
        self._get("/:/scrobble", params={"key": rating_key, "identifier": "com.plexapp.plugins.library"})

    def mark_unwatched(self, rating_key: str) -> None:
        self._get("/:/unscrobble", params={"key": rating_key, "identifier": "com.plexapp.plugins.library"})

    # ------------------------------------------------------------------
    # Playlists
    # ------------------------------------------------------------------

    def playlists(self) -> list[dict[str, Any]]:
        data = self._get("/playlists")
        return data.get("MediaContainer", {}).get("Metadata", [])

    def playlist_items(self, playlist_key: str) -> list[dict[str, Any]]:
        data = self._get(f"{playlist_key}/items")
        return data.get("MediaContainer", {}).get("Metadata", [])

    def create_playlist(self, title: str, media_type: str = "video") -> dict[str, Any]:
        data = self._post("/playlists", params={"title": title, "type": media_type, "smart": 0})
        return data.get("MediaContainer", {})

    def add_to_playlist(self, playlist_id: str, rating_key: str) -> None:
        machine_id = self._get_server_machine_id()
        uri = f"server://{machine_id}/com.plexapp.plugins.library/library/metadata/{rating_key}"
        self._post(f"/playlists/{playlist_id}/items", params={"uri": uri})

    # ------------------------------------------------------------------
    # Collections
    # ------------------------------------------------------------------

    def collections(self, section_key: str) -> list[dict[str, Any]]:
        data = self._get(f"/library/sections/{section_key}/collections")
        return data.get("MediaContainer", {}).get("Metadata", [])

    # ------------------------------------------------------------------
    # Extras / related
    # ------------------------------------------------------------------

    def similar(self, rating_key: str) -> list[dict[str, Any]]:
        data = self._get(f"/library/metadata/{rating_key}/similar")
        return data.get("MediaContainer", {}).get("Metadata", [])

    def extras(self, rating_key: str) -> list[dict[str, Any]]:
        data = self._get(f"/library/metadata/{rating_key}/extras")
        return data.get("MediaContainer", {}).get("Metadata", [])
