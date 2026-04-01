"""Media item sub-menu.

Provides actions for a selected Plex media item.
"""

from __future__ import annotations

from typing import Any

import questionary
from rich.console import Console

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import (
    console,
    error,
    header,
    info,
    media_table,
    metadata_panel,
    success,
)

_MEDIA_ACTIONS = [
    questionary.Choice("View metadata", value="meta"),
    questionary.Choice("Browse children (seasons / episodes / tracks)", value="children"),
    questionary.Choice("Play on a client", value="play"),
    questionary.Choice("Mark as watched", value="watched"),
    questionary.Choice("Mark as unwatched", value="unwatched"),
    questionary.Choice("Add to playlist", value="playlist"),
    questionary.Choice("Show similar / related", value="similar"),
    questionary.Choice("Show extras (trailers, featurettes)", value="extras"),
    questionary.Separator(),
    questionary.Choice("← Back", value="back"),
]


def _choose_client(client: PlexClient) -> dict[str, Any] | None:
    """Let the user pick an available Plex client; return it or None."""
    try:
        clients = client.clients()
    except PlexAPIError as exc:
        error(str(exc))
        return None
    if not clients:
        error("No clients found.  Make sure a Plex player is open.")
        return None
    choices = [questionary.Choice(c.get("name", "?"), value=c) for c in clients]
    choices.append(questionary.Choice("← Cancel", value=None))
    return questionary.select("Choose a client:", choices=choices).ask()


def run_media_menu(client: PlexClient, item: dict[str, Any]) -> None:
    """Interactive sub-menu for a single media item."""
    title = item.get("title", "?")
    rating_key = item.get("ratingKey", "")

    while True:
        header(f"Media: {title}")
        action = questionary.select(
            "What would you like to do?",
            choices=_MEDIA_ACTIONS,
        ).ask()

        if action is None or action == "back":
            break

        if action == "meta":
            try:
                full = client.metadata(rating_key)
            except PlexAPIError as exc:
                error(str(exc))
                continue
            console.print(metadata_panel(full))
            questionary.press_any_key_to_continue("Press any key to continue…").ask()

        elif action == "children":
            try:
                kids = client.children(rating_key)
            except PlexAPIError as exc:
                error(str(exc))
                continue
            if not kids:
                info("No children found.")
                continue
            console.print(media_table(kids, title=f"Children of {title}"))
            chosen = questionary.select(
                "Select an item (or back):",
                choices=[questionary.Choice(k.get("title", "?"), value=k) for k in kids]
                + [questionary.Choice("← Back", value=None)],
            ).ask()
            if chosen:
                run_media_menu(client, chosen)

        elif action == "play":
            chosen_client = _choose_client(client)
            if not chosen_client:
                continue
            address = chosen_client.get("address", "")
            port = str(chosen_client.get("port", "32433"))
            try:
                client.play_media(address, port, rating_key)
                success(f"Sent play command to {chosen_client.get('name', '?')}")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "watched":
            try:
                client.mark_watched(rating_key)
                success("Marked as watched.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "unwatched":
            try:
                client.mark_unwatched(rating_key)
                success("Marked as unwatched.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "playlist":
            try:
                playlists = client.playlists()
            except PlexAPIError as exc:
                error(str(exc))
                continue
            if not playlists:
                info("No playlists found.")
                continue
            choices = [questionary.Choice(p.get("title", "?"), value=p) for p in playlists]
            choices.append(questionary.Choice("← Cancel", value=None))
            chosen_pl = questionary.select("Add to which playlist?", choices=choices).ask()
            if not chosen_pl:
                continue
            pl_id = chosen_pl.get("ratingKey", "")
            try:
                client.add_to_playlist(pl_id, rating_key)
                success(f"Added to '{chosen_pl.get('title')}'.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "similar":
            try:
                similar = client.similar(rating_key)
            except PlexAPIError as exc:
                error(str(exc))
                continue
            if not similar:
                info("No similar items found.")
                continue
            console.print(media_table(similar, title="Similar"))
            questionary.press_any_key_to_continue("Press any key…").ask()

        elif action == "extras":
            try:
                extras = client.extras(rating_key)
            except PlexAPIError as exc:
                error(str(exc))
                continue
            if not extras:
                info("No extras found.")
                continue
            console.print(media_table(extras, title="Extras"))
            questionary.press_any_key_to_continue("Press any key…").ask()
