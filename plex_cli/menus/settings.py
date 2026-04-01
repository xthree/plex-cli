"""Server info and profile management menus."""

from __future__ import annotations

import questionary
from rich.table import Table
from rich import box

from plex_cli.api import PlexAPIError, PlexClient
from plex_cli.config import Config
from plex_cli.display import console, error, header, success


def run_server_info(client: PlexClient) -> None:
    """Display server capabilities and identity."""
    header("Server Info")
    try:
        info = client.server_info()
    except PlexAPIError as exc:
        error(str(exc))
        return

    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column("Key", style="cyan", min_width=22)
    table.add_column("Value")

    fields = [
        ("Friendly name", "friendlyName"),
        ("Machine identifier", "machineIdentifier"),
        ("Platform", "platform"),
        ("Platform version", "platformVersion"),
        ("Version", "version"),
        ("My Plex username", "myPlexUsername"),
        ("My Plex subscription", "myPlexSubscription"),
        ("Transcoder video engines", "transcoderVideoEngines"),
        ("Allow camera upload", "allowCameraUpload"),
    ]
    for label, key in fields:
        val = info.get(key, "")
        if val not in (None, ""):
            table.add_row(label, str(val))

    console.print(table)
    questionary.press_any_key_to_continue("Press any key to return…").ask()


def run_profile_manager(config: Config) -> None:
    """Manage saved server profiles."""
    while True:
        header("Profiles")
        profiles = config.list_profiles()
        default = config.default_profile

        action_choices: list = []
        if profiles:
            for name in profiles:
                label = f"  {name}" + (" [default]" if name == default else "")
                action_choices.append(questionary.Choice(label, value=("select", name)))
            action_choices.append(questionary.Separator())

        action_choices += [
            questionary.Choice("➕ Add profile", value=("add", None)),
            questionary.Choice("🗑  Delete profile", value=("delete", None)),
            questionary.Choice("← Back", value=("back", None)),
        ]

        result = questionary.select("Profiles:", choices=action_choices).ask()
        if result is None:
            break
        action, name = result

        if action == "back":
            break

        if action == "select" and name:
            config.set_default_profile(name)
            success(f"Default profile set to '{name}'.")

        elif action == "add":
            new_name = questionary.text("Profile name:").ask()
            if not new_name:
                continue
            url = questionary.text("Plex server URL (e.g. http://192.168.1.10:32400):").ask()
            if not url:
                continue
            token = questionary.password("Plex token:").ask()
            if not token:
                continue
            config.save_profile(new_name, url, token)
            success(f"Profile '{new_name}' saved.")

        elif action == "delete":
            if not profiles:
                continue
            choices = [questionary.Choice(p, value=p) for p in profiles]
            choices.append(questionary.Choice("← Cancel", value=None))
            to_delete = questionary.select("Delete which profile?", choices=choices).ask()
            if to_delete:
                config.delete_profile(to_delete)
                success(f"Profile '{to_delete}' deleted.")
