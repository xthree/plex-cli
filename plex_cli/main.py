"""plex-cli – interactive Plex Media Server CLI.

Usage
-----
Interactive mode (menus)::

    plex-cli

With saved profile::

    plex-cli --profile home

One-shot / scriptable commands::

    plex-cli search "The Dark Knight"
    plex-cli clients
    plex-cli sessions
    plex-cli on-deck
    plex-cli recently-added
"""

from __future__ import annotations

import sys
from typing import Annotated, Optional

import questionary
import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from plex_cli import __version__
from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.config import Config
from plex_cli.display import (
    client_table,
    console,
    error,
    header,
    info,
    media_table,
    metadata_panel,
    session_table,
    success,
)

app = typer.Typer(
    name="plex-cli",
    help="Interactive CLI for Plex Media Server",
    add_completion=False,
    pretty_exceptions_enable=False,
    no_args_is_help=False,
)

# ---------------------------------------------------------------------------
# Main menu
# ---------------------------------------------------------------------------

_MAIN_MENU = [
    questionary.Choice("🔍 Search media", value="search_media"),
    questionary.Choice("📡 Clients", value="clients"),
    questionary.Choice("📚 Browse libraries", value="libraries"),
    questionary.Choice("▶  On Deck (continue watching)", value="on_deck"),
    questionary.Choice("🆕 Recently Added", value="recently_added"),
    questionary.Choice("📋 Playlists", value="playlists"),
    questionary.Choice("📺 Active Sessions", value="sessions"),
    questionary.Choice("ℹ️  Server Info", value="server_info"),
    questionary.Separator(),
    questionary.Choice("⚙️  Manage profiles", value="profiles"),
    questionary.Separator(),
    questionary.Choice("🚪 Quit", value="quit"),
]


def _build_client(url: str, token: str) -> PlexClient:
    return PlexClient(url, token)


def _interactive_connect(config: Config) -> tuple[PlexClient, str] | None:
    """Prompt for / load server credentials.  Returns (client, profile_name) or None."""
    profiles = config.list_profiles()

    if not profiles:
        console.print(
            Panel(
                "[bold yellow]No profiles configured.[/]\n"
                "You'll need your Plex server URL and a Plex token.\n"
                "Find your token at: https://support.plex.tv/articles/204059436/",
                title="Welcome to plex-cli",
                border_style="cyan",
            )
        )
        name = questionary.text("Profile name (e.g. 'home'):").ask()
        if not name:
            return None
        url = questionary.text("Plex server URL (e.g. http://192.168.1.10:32400):").ask()
        if not url:
            return None
        token = questionary.password("Plex token:").ask()
        if not token:
            return None
        config.save_profile(name, url, token)
        success(f"Profile '{name}' saved.")
        return _build_client(url, token), name

    if len(profiles) == 1:
        active = config.active_profile()
        if active:
            return _build_client(active["url"], active["token"]), profiles[0]

    # Multiple profiles – let user choose
    default = config.default_profile
    choices = [
        questionary.Choice(
            f"{p}" + (" (default)" if p == default else ""),
            value=p,
        )
        for p in profiles
    ]
    choices.append(questionary.Choice("← Cancel", value=None))
    chosen = questionary.select("Select a profile:", choices=choices).ask()
    if not chosen:
        return None
    profile = config.get_profile(chosen)
    if not profile:
        return None
    return _build_client(profile["url"], profile["token"]), chosen


def _run_interactive(client: PlexClient, config: Config) -> None:
    """Main interactive menu loop."""
    from plex_cli.menus.client import run_client_menu
    from plex_cli.menus.libraries import run_libraries_menu
    from plex_cli.menus.playlists import run_playlists_menu
    from plex_cli.menus.search import run_search_clients, run_search_media
    from plex_cli.menus.sessions import (
        run_on_deck_menu,
        run_recently_added_menu,
        run_sessions_menu,
    )
    from plex_cli.menus.settings import run_profile_manager, run_server_info

    console.print(
        Panel(
            Text("🎬  plex-cli", style="bold cyan", justify="center"),
            subtitle=f"v{__version__}",
            border_style="cyan",
        )
    )

    while True:
        header("Main Menu")
        action = questionary.select("Choose an action:", choices=_MAIN_MENU).ask()

        if action is None or action == "quit":
            console.print("[dim]Goodbye![/]")
            break

        if action == "search_media":
            run_search_media(client)
        elif action == "clients":
            from plex_cli.menus.search import run_search_clients
            run_search_clients(client)
        elif action == "libraries":
            run_libraries_menu(client)
        elif action == "on_deck":
            run_on_deck_menu(client)
        elif action == "recently_added":
            run_recently_added_menu(client)
        elif action == "playlists":
            run_playlists_menu(client)
        elif action == "sessions":
            run_sessions_menu(client)
        elif action == "server_info":
            run_server_info(client)
        elif action == "profiles":
            run_profile_manager(config)


# ---------------------------------------------------------------------------
# CLI commands (non-interactive / scriptable)
# ---------------------------------------------------------------------------


def _get_client(
    url: str | None,
    token: str | None,
    profile: str | None,
    config: Config,
    *,
    loud: bool = True,
) -> PlexClient | None:
    """Resolve credentials from flags, env, or config.

    When *loud* is False errors are suppressed (used during callback phase
    so that ``--help`` on subcommands works without printing an error).
    """
    import os

    if url and token:
        return PlexClient(url, token)

    # Check env vars
    env_url = os.environ.get("PLEX_URL")
    env_token = os.environ.get("PLEX_TOKEN")
    if env_url and env_token:
        return PlexClient(env_url, env_token)

    if profile:
        p = config.get_profile(profile)
        if not p:
            if loud:
                error(f"Profile '{profile}' not found.")
            return None
        return PlexClient(p["url"], p["token"])

    active = config.active_profile()
    if active:
        return PlexClient(active["url"], active["token"])

    if loud:
        error(
            "No credentials found.  Use --url and --token flags, "
            "set PLEX_URL / PLEX_TOKEN environment variables, "
            "or run without arguments to configure interactively."
        )
    return None


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    url: Annotated[Optional[str], typer.Option("--url", "-u", help="Plex server URL")] = None,
    token: Annotated[Optional[str], typer.Option("--token", "-t", envvar="PLEX_TOKEN", help="Plex token")] = None,
    profile: Annotated[Optional[str], typer.Option("--profile", "-p", help="Saved profile name")] = None,
    version: Annotated[bool, typer.Option("--version", "-v", is_eager=True)] = False,
) -> None:
    """Interactive CLI for Plex Media Server.

    Run without sub-commands to enter the interactive menu.
    """
    if version:
        console.print(f"plex-cli v{__version__}")
        raise typer.Exit()

    if ctx.invoked_subcommand is not None:
        # Store shared state for sub-commands
        config = Config()
        plex = _get_client(url, token, profile, config, loud=False)
        ctx.ensure_object(dict)
        ctx.obj["client"] = plex
        ctx.obj["config"] = config
        ctx.obj["url"] = url
        ctx.obj["token"] = token
        ctx.obj["profile"] = profile
        return

    # No sub-command → interactive mode
    config = Config()

    if url and token:
        plex: PlexClient | None = PlexClient(url, token)
    else:
        result = _interactive_connect(config)
        if result is None:
            raise typer.Exit(1)
        plex, _ = result

    _run_interactive(plex, config)


def _require_client(ctx: typer.Context) -> PlexClient:
    """Get the client from context; print an error and exit if unavailable."""
    client: PlexClient | None = ctx.obj.get("client") if ctx.obj else None
    if client is None:
        _get_client(
            ctx.obj.get("url") if ctx.obj else None,
            ctx.obj.get("token") if ctx.obj else None,
            ctx.obj.get("profile") if ctx.obj else None,
            ctx.obj.get("config", Config()) if ctx.obj else Config(),
            loud=True,
        )
        raise typer.Exit(1)
    return client


@app.command()
def search(
    ctx: typer.Context,
    query: Annotated[str, typer.Argument(help="Search query")],
    limit: Annotated[int, typer.Option("--limit", "-n", help="Max results")] = 20,
) -> None:
    """Search for media across all libraries."""
    client = _require_client(ctx)
    try:
        results = client.search(query, limit=limit)
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not results:
        info("No results found.")
        return
    console.print(media_table(results, title=f'Results for "{query}"'))


@app.command()
def clients(ctx: typer.Context) -> None:
    """List all available Plex clients."""
    client = _require_client(ctx)
    try:
        result = client.clients()
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not result:
        info("No clients found.")
        return
    console.print(client_table(result))


@app.command()
def sessions(ctx: typer.Context) -> None:
    """Show currently active playback sessions."""
    client = _require_client(ctx)
    try:
        result = client.sessions()
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not result:
        info("No active sessions.")
        return
    console.print(session_table(result))


@app.command(name="on-deck")
def on_deck(
    ctx: typer.Context,
    limit: Annotated[int, typer.Option("--limit", "-n")] = 20,
) -> None:
    """Show On Deck items (continue watching)."""
    client = _require_client(ctx)
    try:
        items = client.on_deck()[:limit]
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not items:
        info("Nothing on deck.")
        return
    console.print(media_table(items, title="On Deck"))


@app.command(name="recently-added")
def recently_added(
    ctx: typer.Context,
    limit: Annotated[int, typer.Option("--limit", "-n")] = 20,
) -> None:
    """Show recently added items."""
    client = _require_client(ctx)
    try:
        items = client.recently_added(limit=limit)
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not items:
        info("Nothing recently added.")
        return
    console.print(media_table(items, title="Recently Added"))


@app.command(name="server-info")
def server_info(ctx: typer.Context) -> None:
    """Show server info and capabilities."""
    client = _require_client(ctx)
    try:
        info_data = client.server_info()
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    from rich import box
    from rich.table import Table

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column("Key", style="cyan", min_width=22)
    table.add_column("Value")
    for k, v in info_data.items():
        if not isinstance(v, (dict, list)) and v not in (None, ""):
            table.add_row(k, str(v))
    console.print(table)


@app.command(name="libraries")
def libraries_cmd(ctx: typer.Context) -> None:
    """List all library sections."""
    client = _require_client(ctx)
    try:
        libs = client.libraries()
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    from rich import box
    from rich.table import Table

    table = Table(box=box.ROUNDED, title="Libraries", header_style="bold cyan")
    table.add_column("#", width=4, style="dim")
    table.add_column("Title", min_width=20)
    table.add_column("Type", min_width=10)
    table.add_column("Key", width=6)
    for i, lib in enumerate(libs, 1):
        table.add_row(str(i), lib.get("title", "?"), lib.get("type", "?"), lib.get("key", ""))
    console.print(table)


@app.command(name="playlists")
def playlists_cmd(ctx: typer.Context) -> None:
    """List all playlists."""
    client = _require_client(ctx)
    try:
        pls = client.playlists()
    except PlexAPIError as exc:
        error(str(exc))
        raise typer.Exit(1)
    if not pls:
        info("No playlists found.")
        return
    from rich import box
    from rich.table import Table

    table = Table(box=box.ROUNDED, title="Playlists", header_style="bold cyan")
    table.add_column("#", width=4, style="dim")
    table.add_column("Title", min_width=20)
    table.add_column("Type", min_width=10)
    table.add_column("Items", width=7, justify="right")
    for i, p in enumerate(pls, 1):
        table.add_row(str(i), p.get("title", "?"), p.get("playlistType", "?"), str(p.get("leafCount", "")))
    console.print(table)


if __name__ == "__main__":
    app()
