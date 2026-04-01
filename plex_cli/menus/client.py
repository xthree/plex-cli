"""Client sub-menu.

Provides playback control and the live player view for a Plex client.
"""

from __future__ import annotations

from typing import Any

import questionary
from rich.console import Console

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import console, error, fmt_duration, header, info, session_table, success
from plex_cli.menus.player import run_player_view

_CLIENT_ACTIONS = [
    questionary.Choice("Open live player view (progress bar + controls)", value="player"),
    questionary.Choice("Play / Resume", value="play"),
    questionary.Choice("Pause", value="pause"),
    questionary.Choice("Stop", value="stop"),
    questionary.Choice("Skip forward 30 s", value="fwd"),
    questionary.Choice("Skip back 30 s", value="rew"),
    questionary.Choice("Jump to position", value="seek"),
    questionary.Choice("Volume up", value="volup"),
    questionary.Choice("Volume down", value="voldown"),
    questionary.Choice("Skip to next item", value="next"),
    questionary.Choice("Skip to previous item", value="prev"),
    questionary.Choice("Show timeline / current state", value="timeline"),
    questionary.Separator(),
    questionary.Choice("← Back", value="back"),
]


def run_client_menu(client: PlexClient, plex_client: dict[str, Any]) -> None:
    """Interactive sub-menu for a single Plex client."""
    name = plex_client.get("name", plex_client.get("title", "?"))
    address = plex_client.get("address", "127.0.0.1")
    port = str(plex_client.get("port", "32433"))

    while True:
        header(f"Client: {name}")
        action = questionary.select("What would you like to do?", choices=_CLIENT_ACTIONS).ask()

        if action is None or action == "back":
            break

        if action == "player":
            try:
                tl = client.get_timeline(address, port)
            except PlexAPIError:
                tl = {}
            run_player_view(client, address, port, tl)

        elif action == "play":
            try:
                client.player_command(address, port, "play")
                success("▶ Play sent.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "pause":
            try:
                client.player_command(address, port, "pause")
                success("⏸ Pause sent.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "stop":
            try:
                client.player_command(address, port, "stop")
                success("⏹ Stop sent.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "fwd":
            try:
                tl = client.get_timeline(address, port)
                offset = int(tl.get("viewOffset", 0)) + 30_000
                client.player_command(address, port, "seekTo", {"offset": offset})
                success(f"⏭ Jumped to {fmt_duration(offset)}.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "rew":
            try:
                tl = client.get_timeline(address, port)
                offset = max(0, int(tl.get("viewOffset", 0)) - 30_000)
                client.player_command(address, port, "seekTo", {"offset": offset})
                success(f"⏮ Jumped to {fmt_duration(offset)}.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "seek":
            time_str = questionary.text(
                "Enter position (e.g. 1:23:45 or 83:45 or 5025 seconds):"
            ).ask()
            if not time_str:
                continue
            try:
                offset_ms = _parse_time(time_str)
                client.player_command(address, port, "seekTo", {"offset": offset_ms})
                success(f"Seeked to {fmt_duration(offset_ms)}.")
            except (ValueError, PlexAPIError) as exc:
                error(str(exc))

        elif action == "volup":
            try:
                client.player_command(address, port, "stepUp")
                success("🔊 Volume up.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "voldown":
            try:
                client.player_command(address, port, "stepDown")
                success("🔉 Volume down.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "next":
            try:
                client.player_command(address, port, "skipNext")
                success("⏭ Skipped to next.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "prev":
            try:
                client.player_command(address, port, "skipPrevious")
                success("⏮ Skipped to previous.")
            except PlexAPIError as exc:
                error(str(exc))

        elif action == "timeline":
            try:
                tl = client.get_timeline(address, port)
            except PlexAPIError as exc:
                error(str(exc))
                continue
            if not tl:
                info("No active playback.")
                continue
            title = tl.get("grandparentTitle") or tl.get("parentTitle") or ""
            ep_title = tl.get("title", "")
            full_title = f"{title} – {ep_title}" if title else ep_title
            state = tl.get("state", "?")
            offset = int(tl.get("viewOffset", 0))
            duration = int(tl.get("duration", 0))
            console.print(
                f"  [bold cyan]{full_title}[/]\n"
                f"  State: [yellow]{state}[/]   "
                f"Position: [green]{fmt_duration(offset)} / {fmt_duration(duration)}[/]"
            )
            questionary.press_any_key_to_continue("Press any key to continue…").ask()


def _parse_time(s: str) -> int:
    """Parse ``H:MM:SS``, ``MM:SS`` or plain seconds into milliseconds."""
    s = s.strip()
    if ":" in s:
        parts = s.split(":")
        if len(parts) == 2:
            total = int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            total = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        else:
            raise ValueError(f"Cannot parse time: {s!r}")
    else:
        total = int(s)
    return total * 1000
