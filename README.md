# plex-cli

An interactive (or scriptable) CLI for your Plex Media Server.

## Features

- **Interactive menus** – navigate with arrow keys; every screen has a *Back* option
- **Search media** – full-text search across all libraries with results in a Rich table
- **Browse libraries** – page through any library section
- **On Deck** – pick up where you left off
- **Recently Added** – see what's new
- **Active Sessions** – see who's watching what and their progress
- **Client control** – list all clients, play/pause/stop, seek, skip, volume
- **Live player view** – full-screen progress bar with keyboard controls (`p` pause, `s` stop, `←/→` skip 30 s, `↑/↓` volume, `q` quit)
- **Playlists** – list, browse items, create, and add media to playlists
- **Metadata browser** – rich metadata panel with summary, cast, genres, etc.
- **Scrobble** – mark items as watched / unwatched
- **Similar & Extras** – discover related content and bonus material
- **Server info** – platform, version, machine identifier
- **Profile management** – save multiple server profiles (stored in `~/.config/plex-cli/config.json`)
- **Scriptable sub-commands** – use flags or environment variables for automation

## Requirements

- Python ≥ 3.10
- A Plex Media Server with a [Plex token](https://support.plex.tv/articles/204059436/)

## Installation

```bash
pip install .
```

Or in editable / development mode:

```bash
pip install -e ".[dev]"
```

## Usage

### Interactive mode

```bash
plex-cli
```

The first run will ask for your server URL and token and save them as a profile.

### Specify credentials inline

```bash
plex-cli --url http://192.168.1.10:32400 --token YOUR_TOKEN
```

### Environment variables

```bash
export PLEX_URL=http://192.168.1.10:32400
export PLEX_TOKEN=YOUR_TOKEN
plex-cli sessions
```

### Scriptable sub-commands

```
plex-cli search "The Dark Knight"          # search all libraries
plex-cli clients                           # list clients
plex-cli sessions                          # active sessions
plex-cli on-deck                           # continue watching
plex-cli recently-added --limit 10        # recent additions
plex-cli libraries                         # list library sections
plex-cli playlists                         # list playlists
plex-cli server-info                       # server details
```

Every sub-command accepts `--help` for details.

### Using a saved profile

```bash
plex-cli --profile home sessions
```

### Managing profiles

```bash
plex-cli          # enter interactive mode → ⚙️  Manage profiles
```

## Interactive menu map

```
Main Menu
├── 🔍 Search media        → results list → Media sub-menu
├── 📡 Clients             → client list  → Client sub-menu
│                                              ├── Live player view (progress bar + keys)
│                                              ├── Play / Pause / Stop
│                                              ├── Seek, Skip ±30 s, Volume
│                                              └── Show timeline
├── 📚 Browse libraries    → section list → item list (paged) → Media sub-menu
├── ▶  On Deck             → item list    → Media sub-menu
├── 🆕 Recently Added      → item list    → Media sub-menu
├── 📋 Playlists           → list / create → items → Media sub-menu
├── 📺 Active Sessions     → table view
├── ℹ️  Server Info         → table view
└── ⚙️  Manage profiles    → add / delete / set default

Media sub-menu
├── View metadata
├── Browse children (seasons / episodes / tracks)
├── Play on a client
├── Mark as watched / unwatched
├── Add to playlist
├── Show similar / related
└── Show extras (trailers, featurettes)
```

## Development

```bash
pip install -e ".[dev]"
pytest
```
