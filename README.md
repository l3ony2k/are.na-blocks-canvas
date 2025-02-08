# Are.na Blocks Canvas

A visual tool for exploring Are.na blocks in a canvas interface. This project allows users to interact with Are.na content in a more spatial and intuitive way.

## Features

- Interactive canvas interface for Are.na blocks
- Drag and drop functionality
- Visual organization of blocks
- Real-time updates with Are.na API
- Responsive design for different screen sizes

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with custom variables for theming
- **API**: Are.na API integration
- **Storage**: Browser LocalStorage for persistence
- **Dependencies**: No external dependencies, built with native web technologies

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Basic understanding of Are.na's functionality

### Installation

1. Clone the repository:
```bash
git clone git@git.sr.ht:~lok/are.na-blocks-canvas
```

2. Navigate to the project directory:
```bash
cd are-na-blocks-canvas
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
are-na-blocks-canvas/
├── css/
│   ├── main.css        # Main styles
│   ├── theme.css       # Theme variables
│   └── components.css  # Component-specific styles
├── js/
│   ├── main.js         # Application entry point
│   ├── blocks.js       # Block management
│   ├── config.js       # Configuration
│   ├── db.js          # Local storage handling
│   ├── router.js      # Routing logic
│   └── ui.js          # UI components
└── index.html         # Main HTML file
```

## Development

### Code Style

- Use ES6+ features
- Follow consistent indentation (2 spaces)
- Keep functions small and focused
- Use meaningful variable and function names
- Comment complex logic and edge cases

### Adding New Features

1. Create feature branch from master
2. Implement changes
3. Test thoroughly in different browsers
4. Submit patch for review
5. Update documentation if needed

### Testing

- Test in multiple browsers
- Verify mobile responsiveness
- Check Are.na API integration
- Validate local storage functionality

## Maintenance

### Regular Tasks

- Update Are.na API integration when needed
- Check for browser compatibility issues
- Review and optimize performance
- Update documentation for new features
- Monitor and fix reported issues

### Performance Considerations

- Minimize DOM operations
- Use efficient CSS selectors
- Implement lazy loading for blocks
- Optimize canvas rendering
- Cache API responses when possible

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit patches to the mailing list

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions and support, please use the following channels:
- Issue tracker: [sr.ht issues](https://todo.sr.ht/~lok/are.na-blocks-canvas)
- Mailing list: [lists.sr.ht](https://lists.sr.ht/~lok/are.na-blocks-canvas)

## Acknowledgments

- Are.na API documentation and team
- Open source community
- All contributors to the project 