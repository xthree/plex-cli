"""Sessions and recently-added / on-deck menus."""

from __future__ import annotations

import questionary

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import console, error, header, info, media_table, session_table
from plex_cli.menus.media import run_media_menu


def run_sessions_menu(client: PlexClient) -> None:
    """Show active sessions on the server."""
    header("Active Sessions")
    try:
        sessions = client.sessions()
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not sessions:
        info("No active sessions.")
        return

    console.print(session_table(sessions))
    questionary.press_any_key_to_continue("Press any key to return…").ask()


def run_on_deck_menu(client: PlexClient) -> None:
    """Show On Deck items (continue watching)."""
    header("On Deck")
    try:
        items = client.on_deck()
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not items:
        info("Nothing on deck.")
        return

    console.print(media_table(items, title="On Deck"))

    choices = [
        questionary.Choice(
            f"{it.get('grandparentTitle','')} – {it.get('title','?')}".lstrip(" – "),
            value=it,
        )
        for it in items
    ]
    choices.append(questionary.Choice("← Back", value=None))
    chosen = questionary.select("Select an item:", choices=choices).ask()
    if chosen:
        run_media_menu(client, chosen)


def run_recently_added_menu(client: PlexClient) -> None:
    """Show recently added items."""
    header("Recently Added")
    try:
        items = client.recently_added()
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not items:
        info("Nothing recently added.")
        return

    console.print(media_table(items, title="Recently Added"))

    choices = [questionary.Choice(it.get("title", "?"), value=it) for it in items]
    choices.append(questionary.Choice("← Back", value=None))
    chosen = questionary.select("Select an item:", choices=choices).ask()
    if chosen:
        run_media_menu(client, chosen)
