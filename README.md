# Are.na Blocks Canvas

A visual tool for exploring Are.na blocks in a canvas interface. This project allows users to interact with Are.na content in a more spatial and intuitive way.

The app uses public browser-side requests against the Are.na API v3 by default. Logging in with an Are.na personal access token unlocks your own (including private) channels.

## Features

- Interactive canvas interface for Are.na blocks
- Drag and drop functionality
- Visual organization of blocks
- Real-time updates with Are.na API v3
- Browse recently surfed channels from the search box; log in to add your own and followed channels (all color-coded by visibility)
- The channel bar shows the channel title, block count, owner, and open / closed / private status until activated for slug entry
- Open a block's original source directly from its detail view
- Block connections and comments: see every channel a block appears in and surf onward opened channels stack like windows so you never lose your place
- Connect blocks to your own channels (write-scope token) with undo
- Browse any user's channels as a canvas (`@username`), your feed, and random surf
- Flow mode: endless canvas with pinch / ctrl+scroll zoom
- Recently surfed history in the app menu (top-left logo)
- Responsive design for different screen sizes

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with custom variables for theming
- **API**: Are.na API v3 integration
- **Storage**: Browser IndexedDB for persistence
- **Dependencies**: No external dependencies, built with native web technologies

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/l3ony2k/are.na-blocks-canvas.git
```

2. Navigate to the project directory:
```bash
cd are.na-blocks-canvas
```

3. Open `index.html` in your web browser or serve it using a local server:
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve
```

## Project Structure

```
are.na-blocks-canvas/
├── css/
│   ├── main.css        # Main styles
│   ├── theme.css       # Theme variables
│   └── components.css  # Component-specific styles
├── images/             # Favicon and app icons
│   ├── favicon.svg
│   ├── favicon.ico
│   └── ...
├── js/
│   ├── main.js         # Application entry point
│   ├── blocks.js       # Block management
│   ├── account.js      # Login, app menu, my-channels dropdown
│   ├── config.js       # Configuration
│   ├── db.js           # Local storage handling
│   ├── router.js       # Routing logic
│   └── ui.js           # UI components
└── index.html          # Main HTML file
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
