# BIM Model Viewer with Clash Detection

A high-performance 3D model viewer for BIM workflows with multi-model support and clash detection visualization.

## Quick Start

```bash
npm install
npm run dev
```

## Features

### ✅ Phase 1: Multi-Model Management
- Load multiple GLB models simultaneously
- Discipline-based organization (Architecture, Structure, Mechanical, Electrical, Plumbing, Other)
- Individual model visibility controls
- Per-model batching for optimal performance

### ✅ Phase 2: GUID Search & Focus
- Search objects by GUID (Global Unique Identifier)
- Automatic highlighting of found objects
- Smart camera positioning to view selected objects
- Debug tools for inspecting model data

### 🚧 Coming Soon
- Phase 2.3: Hide/transparent surrounding objects
- Phase 4: Clash detection from CSV

## Usage

### Loading Models
1. Click **"Open .glb"** to load a model
2. Select the discipline from the modal
3. Use the **Models panel** (top-right) to:
   - Toggle individual model visibility (eye icon)
   - Toggle all models (click "All")
   - Remove models (× button)

### GUID Search
1. Click **"Find by GUID: On"** to activate search
2. Enter GUID(s) in the input field (comma-separated for multiple)
3. Click **"Focus"** or press **Enter** to search and highlight
4. Objects will be highlighted in green and camera will focus on them

### Debug Console
Open browser DevTools console and use:
```javascript
debugViewer.listGUIDs()           // List all available GUIDs
debugViewer.inspect()             // Inspect model structure
debugViewer.searchGUID("guid")    // Search for specific GUID
debugViewer.searchByName("name")  // Search by object name
```

## Architecture

The viewer is built with a modular controller-based architecture for maintainability:

### Core Controllers
- **`Viewer.ts`** (400 lines) - Main orchestrator, public API
- **`GuidController.ts`** - GUID search, highlighting, camera focusing
- **`EdgeController.ts`** - Edge overlay rendering and caching
- **`ModelLoaderController.ts`** - GLB loading and model management
- **`SelectionController.ts`** - Object selection via raycasting
- **`HighlightController.ts`** - Text-based mesh highlighting
- **`AdaptiveResolutionController.ts`** - Dynamic quality adjustment
- **`InteractionCullingController.ts`** - Viewport-based culling

### Supporting Modules
- **`ModelManager.ts`** - Multi-model state management
- **`ClipperController.ts`** - Section plane management
- **`batching.ts`** - Mesh merging for performance

## Tech Stack

- **Three.js** - 3D rendering
- **@thatopen/components** - BIM/IFC utilities
- **TypeScript** - Type safety
- **Vite** - Fast development
