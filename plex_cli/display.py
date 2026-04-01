"""Shared display helpers built on top of Rich."""

from __future__ import annotations

from typing import Any

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()


# ---------------------------------------------------------------------------
# Common formatting helpers
# ---------------------------------------------------------------------------


def fmt_duration(ms: int | None) -> str:
    """Convert milliseconds to a human-readable ``H:MM:SS`` string."""
    if ms is None:
        return "--:--"
    total_s = int(ms) // 1000
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def fmt_year(item: dict[str, Any]) -> str:
    year = item.get("year") or item.get("parentYear") or ""
    return str(year) if year else ""


def fmt_type(item: dict[str, Any]) -> str:
    t = item.get("type", "unknown")
    return {
        "movie": "🎬 Movie",
        "show": "📺 Show",
        "season": "📅 Season",
        "episode": "📺 Episode",
        "artist": "🎤 Artist",
        "album": "💿 Album",
        "track": "🎵 Track",
        "photo": "📷 Photo",
        "clip": "🎞  Clip",
        "playlist": "📋 Playlist",
        "collection": "📁 Collection",
    }.get(t, t.capitalize())


def fmt_watched(item: dict[str, Any]) -> str:
    if item.get("viewCount", 0):
        return "✓"
    if item.get("viewOffset"):
        return "▶"
    return ""


def media_table(items: list[dict[str, Any]], title: str = "") -> Table:
    """Build a Rich table for a list of Plex metadata items."""
    table = Table(
        box=box.ROUNDED,
        title=title or None,
        show_header=True,
        header_style="bold cyan",
        expand=False,
        highlight=True,
    )
    table.add_column("#", style="dim", no_wrap=True, width=4)
    table.add_column("Title", min_width=24, max_width=48)
    table.add_column("Type", width=14)
    table.add_column("Year", width=6, justify="right")
    table.add_column("Duration", width=9, justify="right")
    table.add_column("Watched", width=8, justify="center")
    table.add_column("Rating", width=8, justify="right")

    for i, item in enumerate(items, 1):
        title_text = item.get("title") or item.get("name") or "(no title)"
        rating = item.get("rating") or item.get("userRating") or ""
        rating_str = f"{float(rating):.1f}" if rating else ""
        table.add_row(
            str(i),
            title_text,
            fmt_type(item),
            fmt_year(item),
            fmt_duration(item.get("duration")),
            fmt_watched(item),
            rating_str,
        )
    return table


def client_table(clients: list[dict[str, Any]]) -> Table:
    table = Table(
        box=box.ROUNDED,
        title="Clients",
        show_header=True,
        header_style="bold cyan",
        expand=False,
    )
    table.add_column("#", style="dim", width=4)
    table.add_column("Name", min_width=20)
    table.add_column("Product", min_width=14)
    table.add_column("Platform", min_width=12)
    table.add_column("State", width=10)
    table.add_column("Address", min_width=16)

    for i, c in enumerate(clients, 1):
        table.add_row(
            str(i),
            c.get("name", c.get("title", "?")),
            c.get("product", ""),
            c.get("platform", ""),
            c.get("state", ""),
            c.get("address", ""),
        )
    return table


def session_table(sessions: list[dict[str, Any]]) -> Table:
    table = Table(
        box=box.ROUNDED,
        title="Active Sessions",
        show_header=True,
        header_style="bold magenta",
        expand=False,
    )
    table.add_column("#", style="dim", width=4)
    table.add_column("User", min_width=14)
    table.add_column("Title", min_width=24)
    table.add_column("Player", min_width=16)
    table.add_column("State", width=10)
    table.add_column("Progress", width=16)

    for i, s in enumerate(sessions, 1):
        user = s.get("User", {}).get("title", "?")
        title = s.get("grandparentTitle", "")
        if title:
            title += " – " + s.get("title", "")
        else:
            title = s.get("title", "?")
        player = s.get("Player", {})
        player_name = player.get("title", player.get("product", "?"))
        state = player.get("state", "?")
        offset = int(s.get("viewOffset", 0))
        duration = int(s.get("duration", 0))
        if duration:
            pct = int(offset / duration * 100)
            progress = f"{fmt_duration(offset)} / {fmt_duration(duration)} ({pct}%)"
        else:
            progress = fmt_duration(offset)
        table.add_row(str(i), user, title, player_name, state, progress)
    return table


def metadata_panel(item: dict[str, Any]) -> Panel:
    """Render a single item's metadata in a Rich Panel."""
    lines: list[str] = []
    title = item.get("title", "?")
    subtitle = item.get("tagline") or ""
    lines.append(f"[bold yellow]{title}[/]")
    if subtitle:
        lines.append(f"[italic]{subtitle}[/]")
    lines.append("")

    fields = [
        ("Type", fmt_type(item)),
        ("Year", fmt_year(item)),
        ("Duration", fmt_duration(item.get("duration"))),
        ("Rating", str(item.get("contentRating", ""))),
        ("Audience Rating", f"{item.get('audienceRating', '')}"),
        ("Studio", item.get("studio", "")),
        ("Added", item.get("addedAt", "")),
    ]
    for label, value in fields:
        if value and str(value).strip():
            lines.append(f"[cyan]{label}:[/] {value}")

    summary = item.get("summary", "")
    if summary:
        lines.append("")
        lines.append("[cyan]Summary:[/]")
        lines.append(summary[:400] + ("…" if len(summary) > 400 else ""))

    genres = [g.get("tag", "") for g in item.get("Genre", [])]
    if genres:
        lines.append(f"[cyan]Genres:[/] {', '.join(genres)}")

    directors = [d.get("tag", "") for d in item.get("Director", [])]
    if directors:
        lines.append(f"[cyan]Director:[/] {', '.join(directors)}")

    writers = [w.get("tag", "") for w in item.get("Writer", [])]
    if writers:
        lines.append(f"[cyan]Writer:[/] {', '.join(writers)}")

    cast = [r.get("tag", "") for r in item.get("Role", [])][:6]
    if cast:
        lines.append(f"[cyan]Cast:[/] {', '.join(cast)}")

    return Panel("\n".join(lines), title="Metadata", border_style="cyan", padding=(1, 2))


def error(msg: str) -> None:
    console.print(f"[bold red]Error:[/] {msg}")


def success(msg: str) -> None:
    console.print(f"[bold green]✓[/] {msg}")


def info(msg: str) -> None:
    console.print(f"[dim]{msg}[/]")


def header(title: str) -> None:
    console.print()
    console.rule(f"[bold cyan]{title}[/]")
    console.print()
