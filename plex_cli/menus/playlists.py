"""Playlists menu."""

from __future__ import annotations

import questionary

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import console, error, header, info, media_table
from plex_cli.menus.media import run_media_menu


def run_playlists_menu(client: PlexClient) -> None:
    """Browse playlists, view their items, or create new ones."""
    while True:
        header("Playlists")
        try:
            playlists = client.playlists()
        except PlexAPIError as exc:
            error(str(exc))
            return

        action_choices = [
            questionary.Choice("➕ Create new playlist", value="create"),
        ]
        if playlists:
            pl_choices = [
                questionary.Choice(f"{p.get('title','?')} ({p.get('leafCount',0)} items)", value=p)
                for p in playlists
            ]
            action_choices = pl_choices + [questionary.Separator()] + action_choices
        action_choices.append(questionary.Choice("← Back", value="back"))

        chosen = questionary.select("Select a playlist:", choices=action_choices).ask()

        if chosen is None or chosen == "back":
            break

        if chosen == "create":
            title = questionary.text("Playlist name:").ask()
            if title:
                try:
                    client.create_playlist(title)
                    from plex_cli.display import success
                    success(f"Created playlist '{title}'.")
                except PlexAPIError as exc:
                    error(str(exc))
            continue

        # Show playlist items
        pl_key = chosen.get("key", "")
        pl_title = chosen.get("title", "?")
        header(f"Playlist: {pl_title}")
        try:
            items = client.playlist_items(pl_key)
        except PlexAPIError as exc:
            error(str(exc))
            continue

        if not items:
            info("Playlist is empty.")
            continue

        console.print(media_table(items, title=pl_title))

        item_choices = [questionary.Choice(it.get("title", "?"), value=it) for it in items]
        item_choices.append(questionary.Choice("← Back", value=None))
        selected = questionary.select("Select an item to open:", choices=item_choices).ask()
        if selected:
            run_media_menu(client, selected)
