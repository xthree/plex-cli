"""Player view – live TUI that shows playback progress and controls.

Run in the foreground via :func:`run_player_view`.
"""

from __future__ import annotations

import threading
import time
from typing import Any

from rich.align import Align
from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TaskID, TextColumn
from rich.table import Table
from rich.text import Text

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.display import fmt_duration

console = Console()

POLL_INTERVAL = 2  # seconds between timeline polls


def _controls_panel(state: str) -> Panel:
    if state == "playing":
        play_label = "[bold]⏸  Pause[/]   [p]"
    else:
        play_label = "[bold]▶  Play[/]    [p]"
    lines = (
        f"  {play_label}     [bold]⏹  Stop[/]   [s]     "
        "[bold]⏮  -30s[/]  [←]     [bold]⏭  +30s[/]  [→]     "
        "[bold]↑/↓[/] Volume     [bold]q[/] Quit"
    )
    return Panel(lines, title="Controls", border_style="yellow", padding=(0, 2))


def _media_info_panel(timeline: dict[str, Any]) -> Panel:
    title = timeline.get("title") or "No media"
    parent = timeline.get("grandparentTitle") or timeline.get("parentTitle") or ""
    full_title = f"{parent} – {title}" if parent else title
    state = timeline.get("state", "stopped")
    state_icon = {"playing": "▶", "paused": "⏸", "stopped": "⏹", "buffering": "⏳"}.get(state, "?")
    text = Text()
    text.append(f"  {state_icon}  ", style="bold yellow")
    text.append(full_title, style="bold white")
    return Panel(text, border_style="cyan", padding=(0, 1))


def _progress_bar(offset_ms: int, duration_ms: int) -> Progress:
    progress = Progress(
        TextColumn("{task.fields[elapsed]}"),
        BarColumn(bar_width=None),
        TextColumn("{task.fields[total_str]}"),
        expand=True,
    )
    task: TaskID = progress.add_task(
        "",
        total=max(duration_ms, 1),
        elapsed=fmt_duration(offset_ms),
        total_str=fmt_duration(duration_ms),
    )
    progress.update(task, completed=offset_ms)
    return progress


def run_player_view(
    client: PlexClient,
    client_address: str,
    client_port: str,
    initial_timeline: dict[str, Any] | None = None,
) -> None:
    """Display a live player TUI.  Press ``q`` to return to the menu."""
    import sys

    # Check if stdin is a real tty; if not just poll and show status lines.
    interactive = sys.stdin.isatty()

    timeline: dict[str, Any] = initial_timeline or {}
    stop_event = threading.Event()
    input_queue: list[str] = []

    def _poll_loop() -> None:
        while not stop_event.is_set():
            try:
                tl = client.get_timeline(client_address, client_port)
                if tl:
                    timeline.update(tl)
            except PlexAPIError:
                pass
            stop_event.wait(POLL_INTERVAL)

    poller = threading.Thread(target=_poll_loop, daemon=True)
    poller.start()

    def _build_layout() -> Layout:
        layout = Layout()
        layout.split_column(
            Layout(name="info", size=3),
            Layout(name="progress", size=3),
            Layout(name="controls", size=3),
        )
        offset = int(timeline.get("viewOffset", 0))
        duration = int(timeline.get("duration", 0))
        state = timeline.get("state", "stopped")
        layout["info"].update(_media_info_panel(timeline))
        layout["progress"].update(
            Panel(_progress_bar(offset, duration), border_style="blue", padding=(0, 1))
        )
        layout["controls"].update(_controls_panel(state))
        return layout

    if not interactive:
        # Non-interactive mode: just print a line and return
        console.print("[yellow]Player view requires an interactive terminal.[/]")
        stop_event.set()
        return

    # We need raw key reading.  Use a simple approach with the 'keyboard' or
    # fallback to a loop that only exits on 'q' sent via stdin.
    try:
        import tty
        import termios

        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
    except Exception:
        console.print("[yellow]Cannot enable raw keyboard input.[/]")
        stop_event.set()
        return

    with Live(_build_layout(), refresh_per_second=2, console=console, screen=False) as live:
        try:
            tty.setraw(fd)

            def _handle_key(ch: str) -> bool:
                """Return True to quit."""
                if ch in ("q", "Q", "\x03"):
                    return True
                try:
                    if ch == "p":
                        state = timeline.get("state", "stopped")
                        cmd = "pause" if state == "playing" else "play"
                        client.player_command(client_address, client_port, cmd)
                    elif ch == "s":
                        client.player_command(client_address, client_port, "stop")
                    elif ch == "\x1b":
                        # Read escape sequence
                        next1 = sys.stdin.read(1)
                        if next1 == "[":
                            next2 = sys.stdin.read(1)
                            offset = int(timeline.get("viewOffset", 0))
                            if next2 == "C":  # right arrow
                                client.player_command(
                                    client_address, client_port, "seekTo",
                                    {"offset": max(0, offset + 30000)}
                                )
                            elif next2 == "D":  # left arrow
                                client.player_command(
                                    client_address, client_port, "seekTo",
                                    {"offset": max(0, offset - 30000)}
                                )
                            elif next2 == "A":  # up arrow
                                client.player_command(client_address, client_port, "stepUp")
                            elif next2 == "B":  # down arrow
                                client.player_command(client_address, client_port, "stepDown")
                except PlexAPIError:
                    pass
                return False

            import select

            while True:
                live.update(_build_layout())
                r, _, _ = select.select([sys.stdin], [], [], POLL_INTERVAL)
                if r:
                    ch = sys.stdin.read(1)
                    if _handle_key(ch):
                        break
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            stop_event.set()
