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
- Multi-color highlighting (green, purple, cyan, orange, etc.)
- Smart camera positioning to view selected objects
- Configurable camera controls (distance, angle, offsets)
- Debug tools for inspecting model data

### ✅ Phase 2.3: Surrounding Objects Control
- **Hide Others** - Isolate selected objects (hide unselected)
- **Transparent Others** - Make unselected objects 85% transparent
- Perfect for clash detection and analysis

### ✅ Multiple File Loading
- Select and load multiple GLB files at once
- Assign discipline labels to each file individually
- Sequential processing with progress indicator

### 🚧 Coming Soon
- Phase 4: Clash detection cards from CSV

## Usage

### Loading Models

#### Single File:
1. Click **"Open .glb"**
2. Select ONE GLB file
3. Choose discipline from modal
4. Model loads automatically

#### Multiple Files:
1. Click **"Open .glb"**
2. Select MULTIPLE GLB files (Ctrl/Cmd + click or Shift + click)
3. For each file, a modal appears showing:
   - **"Select Discipline (1/3): filename.glb"**
4. Choose discipline for each file one by one
5. All models load sequentially

#### Managing Models:
Use the **Models panel** (top-right) to:
- Toggle individual model visibility (eye icon)
- Toggle all models (click "All")
- Remove models (× button)

### GUID Search & Clash Detection
1. Click **"Find by GUID: On"** to activate search
2. Enter GUID(s) in the input field (comma-separated for multiple)
   - Example: `guid1, guid2` for clash detection
3. Click **"Focus"** or press **Enter** to search and highlight
4. Objects will be highlighted in different colors:
   - 1st object: 🟢 Green
   - 2nd object: 🟣 Purple
   - 3rd+ objects: Cyan, Orange, Yellow, etc.

#### Surrounding Objects Control:
After highlighting objects, use:
- **"Hide Others"** (🔴 Red) - Hides all unselected objects (isolation view)
- **"Transparent Others"** (🔵 Cyan) - Makes unselected objects 85% transparent (context view)
- Click again to return to normal view

Perfect for analyzing clashes from your CSV data!

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
