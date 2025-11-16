HexGL
=========

Source code of [HexGL](http://hexgl.bkcore.com), the futuristic HTML5 racing game by [Thibaut Despoulain](http://bkcore.com)

## Branches
  * **[Master](https://github.com/BKcore/HexGL)** - Public release (stable).

## License

Unless specified in the file, HexGL's code and resources are now licensed under the *MIT License*.

## Build Setup

This project uses a modern build pipeline with Vite for bundling, CoffeeScript compilation, and asset management.

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

```bash
git clone git://github.com/BKcore/HexGL.git
cd HexGL
npm install
```

### Development

To run the development server with hot module reload:

```bash
npm run dev
```

The dev server will be available at `http://localhost:5173/`

### Production Build

To create an optimized production build:

```bash
npm run build
```

The built files will be output to the `dist/` directory with hashed filenames for cache busting.
- Minified JavaScript bundle
- Processed CSS
- Static assets (textures, geometries, audio)
- Font files and icon assets

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/` - Source code including CoffeeScript and JavaScript modules
  - `bkcore/` - Core game engine modules
  - `main.js` - Application entry point
- `css/` - Stylesheets and font assets
- `libs/` - Third-party libraries (Three.js postprocessing, DAT.GUI, etc.)
- `textures/` - Game textures and assets
- `geometries/` - 3D model data
- `audio/` - Sound effects and audio files
- `index.html` - Main HTML file

## Development Workflow

### CoffeeScript Sources

CoffeeScript source files are located in:
- `src/bkcore/` - Compiled from original CoffeeScript sources
- Changes to CoffeeScript files automatically trigger recompilation during dev

### JavaScript Modules

The application uses ES6 modules throughout. The build process:
1. Processes all imports
2. Bundles modules with Vite
3. Minifies output for production
4. Copies static assets to dist folder

### Hot Reload

During development (`npm run dev`), any changes to source files will automatically reload the browser.

## Asset Management

### Textures and Geometries

Full size textures can be enabled by swapping the `textures/` and `textures.full/` directories before building.

### Static Assets

The following assets are copied to dist during build:
- Textures (all sizes)
- Geometries
- Audio files
- Fonts (BebasNeue)
- Icon files

These are hashed for cache busting in production.

## Note

The development of HexGL is in a hiatus for now until I find some time and interest to work on it again.
That said, feel free to post issues, patches, or anything to make the game better and I'll gladly review and merge them.
