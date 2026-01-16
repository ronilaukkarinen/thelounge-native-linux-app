# The Lounge - Native Linux app

[![Built with Electron](https://img.shields.io/badge/Built_with-Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![Linux](https://img.shields.io/badge/Linux-Arch_Linux-1793D1?style=for-the-badge&logo=archlinux&logoColor=white)](https://archlinux.org)
[![forthebadge](https://forthebadge.com/images/badges/works-on-my-machine.svg)](https://forthebadge.com)

A native Linux wrapper for [The Lounge](https://thelounge.chat/) IRC client with native desktop notifications and system integration.

Looking for macOS? Check out [thelounge-native-mac-app](https://github.com/ronilaukkarinen/thelounge-native-mac-app).

## Features

- Native desktop notifications via Electron Notification API
- Window state persistence (size and position remembered)
- External links open in default browser
- Custom scrollbar styling
- F12 to toggle DevTools
- Service Worker notification interception for The Lounge

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
git clone https://github.com/ronilaukkarinen/thelounge-native-linux-app.git
cd thelounge-native-linux-app
npm install
```

## Usage

```bash
npm start
```

## Configuration

The app connects to `https://irc.pulina.fi` by default. To change the URL, edit `main.js` and update the `loadURL` call.

## Desktop entry

Create `~/.local/share/applications/thelounge.desktop`:

```desktop
[Desktop Entry]
Name=The Lounge
Exec=/path/to/thelounge-native-linux-app/start.sh
Icon=/path/to/thelounge-native-linux-app/thelounge.png
Type=Application
Categories=Network;Chat;
```

## Contributing

Contributions are welcome.
