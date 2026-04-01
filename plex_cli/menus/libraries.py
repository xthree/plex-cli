"""Libraries browser menu."""

from __future__ import annotations

import questionary

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import console, error, header, info, media_table
from plex_cli.menus.media import run_media_menu

_PAGE_SIZE = 20


def run_libraries_menu(client: PlexClient) -> None:
    """Browse library sections and drill into their contents."""
    header("Libraries")
    try:
        libs = client.libraries()
    except PlexAPIError as exc:
        error(str(exc))
        return

    if not libs:
        info("No libraries found.")
        return

    choices = [
        questionary.Choice(
            f"{lib.get('title','?')} ({lib.get('type','?')})",
            value=lib,
        )
        for lib in libs
    ]
    choices.append(questionary.Choice("← Back", value=None))

    chosen = questionary.select("Select a library:", choices=choices).ask()
    if not chosen:
        return

    _browse_library(client, chosen)


def _browse_library(client: PlexClient, lib: dict) -> None:
    section_key = lib.get("key", "")
    title = lib.get("title", "?")
    offset = 0

    while True:
        header(f"Library: {title}")
        try:
            items, total = client.library_contents(section_key, limit=_PAGE_SIZE, offset=offset)
        except PlexAPIError as exc:
            error(str(exc))
            return

        if not items:
            info("No items in this library.")
            return

        console.print(media_table(items, title=f"{title}  ({offset + 1}–{offset + len(items)} of {total})"))

        nav_choices = [questionary.Choice(it.get("title", "?"), value=it) for it in items]
        if offset > 0:
            nav_choices.insert(0, questionary.Choice("← Previous page", value="prev"))
        if offset + len(items) < total:
            nav_choices.append(questionary.Choice("Next page →", value="next"))
        nav_choices.append(questionary.Choice("← Back to libraries", value="back"))

        chosen = questionary.select("Select an item:", choices=nav_choices).ask()

        if chosen is None or chosen == "back":
            break
        elif chosen == "next":
            offset += _PAGE_SIZE
        elif chosen == "prev":
            offset = max(0, offset - _PAGE_SIZE)
        elif isinstance(chosen, dict):
            run_media_menu(client, chosen)
