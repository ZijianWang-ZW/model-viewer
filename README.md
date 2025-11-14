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

### 🚧 Coming Soon
- Phase 2: GUID-based object highlighting
- Phase 3: Smart camera positioning
- Phase 4: Clash detection from CSV

## Usage

1. Click **"Open .glb"** to load a model
2. Select the discipline from the modal
3. Use the **Models panel** (top-right) to:
   - Toggle individual model visibility (eye icon)
   - Toggle all models (click "All")
   - Remove models (× button)

## Tech Stack

- **Three.js** - 3D rendering
- **@thatopen/components** - BIM/IFC utilities
- **TypeScript** - Type safety
- **Vite** - Fast development
