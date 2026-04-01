"""Search menus (media search and client discovery)."""

from __future__ import annotations

from typing import Any

import questionary

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import client_table, console, error, header, info, media_table
from plex_cli.menus.client import run_client_menu
from plex_cli.menus.media import run_media_menu


def run_search_media(client: PlexClient) -> None:
    """Search all libraries for media and open the media sub-menu on selection."""
    header("Search Media")
    query = questionary.text("Enter search query (blank to cancel):").ask()
    if not query:
        return

    try:
        results = client.search(query)
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not results:
        info("No results found.")
        return

    console.print(media_table(results, title=f'Results for "{query}"'))

    choices = [
        questionary.Choice(
            f"{r.get('title','?')} ({r.get('type','?')}, {r.get('year','')})",
            value=r,
        )
        for r in results
    ]
    choices.append(questionary.Choice("← Back", value=None))

    chosen = questionary.select("Select an item:", choices=choices).ask()
    if chosen:
        run_media_menu(client, chosen)


def run_search_clients(client: PlexClient) -> None:
    """List available Plex clients and open the client sub-menu on selection."""
    header("Clients")
    try:
        clients = client.clients()
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not clients:
        info("No clients found.  Make sure a Plex player is running.")
        return

    console.print(client_table(clients))

    choices = [
        questionary.Choice(c.get("name", c.get("title", "?")), value=c) for c in clients
    ]
    choices.append(questionary.Choice("← Back", value=None))

    chosen = questionary.select("Select a client:", choices=choices).ask()
    if chosen:
        run_client_menu(client, chosen)
