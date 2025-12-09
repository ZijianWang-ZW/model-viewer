# 🔍 Clash Detection Viewer Guide

## Overview

The Clash Detection Viewer is a high-tech, modern UI component that displays clash detection results from BIM models. It automatically highlights clashing objects, focuses the camera, and provides AI-powered analysis for each clash.

---

## ✨ Features

### **1. Clash Card Display**
- **Modern UI**: Dark theme with gradients and animations
- **Detailed Information**: Issue name, description, component details, and AI analysis
- **Visual Badges**: Color-coded relevance and type indicators
- **AI Insights**: GPT-4V analysis with confidence levels

### **2. Navigation**
- **Arrow Buttons**: Navigate between clashes with Previous/Next buttons
- **Keyboard Shortcuts**: 
  - `←` Left Arrow: Previous clash
  - `→` Right Arrow: Next clash
  - `Esc`: Close viewer
- **Counter**: Shows current clash position (e.g., "5 / 20")

### **3. Automatic Object Highlighting**
- **Multi-color Highlights**: Each component in a clash gets a distinct color
- **Auto-hide**: Non-clashing objects are automatically hidden
- **Camera Focus**: Automatically frames the clashing objects in view

### **4. Visibility Controls**
- **Show All Button**: Quickly reveal all hidden objects
- **Close Button**: Exit clash viewer and restore normal view

---

## 🎨 UI Components

### **Card Sections**

1. **Header**
   - Clash name (e.g., "Pipe.1.10 is inside Duct.2.6")
   - Relevance badge (Relevant/Irrelevant)
   - Type badge (Hard Clash/Intentional/Tolerable Clash)

2. **Components Section** 📋
   - Component names
   - Component types (e.g., IfcPipeSegmentType)
   - Component GUIDs (for developer reference)

3. **Description Section** 📝
   - Detailed clash information
   - Clash size (length, width, height, volume)
   - Tolerance thresholds

4. **AI Analysis Section** 🤖
   - GPT-4V relevance assessment
   - Clash type classification
   - Confidence level
   - Detailed reasoning

---

## 🚀 Usage

### **Opening the Clash Viewer**

1. **Load Models**: First, load your BIM models (GLB files)
2. **Click the Clash Button**: A floating red button at the bottom-right: "🔍 Clashes"
3. **Viewer Opens**: The clash card appears with the first issue

### **Navigating Clashes**

**Using Buttons:**
- Click "Previous" to go back
- Click "Next" to advance
- Buttons are disabled at the first/last clash

**Using Keyboard:**
```
Left Arrow  → Previous clash
Right Arrow → Next clash
Escape      → Close viewer
```

### **Viewing Clashing Objects**

When a clash card is displayed:
1. ✅ The clashing components are automatically highlighted with distinct colors
2. ✅ All other objects are hidden for clarity
3. ✅ The camera focuses on the clash location
4. ✅ You can orbit/zoom to inspect the clash in detail

### **Showing All Objects**

If you need to see the context:
1. Click the **"👁️ Show All"** button in the top-right
2. All hidden objects become visible again
3. Highlighted objects remain highlighted
4. Navigate to another clash to auto-hide again

### **Closing the Viewer**

- Click the **✕** button in the top-right, OR
- Press `Esc` on your keyboard
- All highlights are cleared
- All objects become visible again

---

## 📊 Data Source

### **CSV File Format**

The viewer reads from `public/clash_results_20.csv` with the following columns:

| Column | Description |
|--------|-------------|
| `Issue Name` | Clash title (e.g., "Pipe is inside Duct") |
| `Issue GUID` | Unique identifier for the clash issue |
| `Description` | Detailed clash information |
| `Component Name` | Array of component names |
| `Component Type` | Array of IFC types |
| `Component GUID` | Array of GUIDs to locate objects |
| `GPT4V_Relevance` | AI assessment: Relevant/Irrelevant |
| `GPT4V_Type` | AI classification: Hard Clash/Tolerable |
| `GPT4V_Confidence` | Confidence level: High/Medium/Low |
| `GPT4V_Reasoning` | Detailed explanation |
| `Consensus_Relevance` | Final consensus on relevance |
| `Consensus_Type` | Final consensus on type |

### **Component GUID Matching**

The viewer uses `Component GUID` values to find and highlight objects in the 3D scene. These GUIDs are matched against:
- `userData.name`
- `mesh.name`
- `userData.guid`
- `userData.GlobalId`
- `userData.expressID`
- `userData.ifcGuid`
- `userData.GUID`

---

## 🎨 Visual Design

### **Color Scheme**

| Element | Color | Purpose |
|---------|-------|---------|
| Background | Dark blue gradients | High-tech aesthetic |
| Accent | Cyan (#00d9ff) | Highlights and interactive elements |
| Danger | Red (#e94560) | Close button, relevant clashes |
| Success | Teal (#4ecdc4) | Tolerable clashes |
| Warning | Orange/Yellow | Warnings and alerts |

### **Component Highlights**

When multiple components clash, each gets a unique color:
1. 🟢 Green
2. 🟣 Purple
3. 🔵 Cyan
4. 🟠 Orange
5. 🟡 Yellow
6. 🟣 Magenta
7. 🟢 Lime
8. 🩷 Pink

### **Badges**

**Relevance:**
- `Relevant`: Red gradient with shadow
- `Irrelevant`: Gray with border

**Type:**
- `Hard Clash`: Red gradient (requires action)
- `Intentional/Tolerable Clash`: Teal gradient (acceptable)

---

## 💻 Developer API

### **ClashCardManager Class**

```typescript
const clashCardManager = new ClashCardManager(viewer);

// Load clash data
await clashCardManager.loadClashesFromCSV('/clash_results_20.csv');

// Show/hide card
clashCardManager.showCard();
clashCardManager.hideCard();

// Check status
const count = clashCardManager.getClashCount();
const hasData = clashCardManager.hasClashes();
```

### **Integration Points**

The clash viewer integrates with:
- **GuidController**: For object highlighting
- **Viewer.findMeshesByGUIDs()**: To locate objects
- **Viewer.addGuidHighlights()**: To apply multi-color highlights
- **Viewer.setSurroundingMode()**: To hide/show unselected objects
- **Viewer.focusOnObjects()**: To frame the camera

---

## 🔧 Customization

### **Changing the CSV Path**

In `src/main.ts`:
```typescript
clashCardManager.loadClashesFromCSV('/your-file.csv');
```

### **Adjusting Camera Focus**

Use the camera configuration API:
```javascript
debugViewer.setCameraConfig({
  distanceMultiplier: 2.0,  // Zoom out more
  viewAngle: { x: 1, y: 1.5, z: 1 },  // Steeper angle
  animated: true,
  verticalOffset: 2,
  horizontalOffset: 0
});
```

### **Modifying Colors**

Edit the CSS in `index.html`:
```css
#clash-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.badge-relevant {
  background: linear-gradient(135deg, #e94560 0%, #d63447 100%);
}
```

---

## 🐛 Troubleshooting

### **"No clash results loaded" Alert**

**Problem**: CSV file not found

**Solutions**:
1. Check that `clash_results_20.csv` exists in the `public/` folder
2. Verify the file name matches exactly (case-sensitive)
3. Check browser console for fetch errors
4. Ensure the dev server has access to the public folder

### **Objects Not Highlighting**

**Problem**: GUIDs not found in model

**Solutions**:
1. Verify the model contains the GUIDs from the CSV
2. Use `debugViewer.listGUIDs()` to see available GUIDs
3. Check that batching is OFF (it should be by default)
4. Ensure models are fully loaded before opening clash viewer

### **Card Not Appearing**

**Problem**: UI elements missing

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify all HTML elements exist: `#clash-card-container`, `#clash-card`, etc.
3. Clear browser cache and reload
4. Check that CSS is loaded correctly

---

## 📝 Example Workflow

### **Typical Clash Review Session**

1. **Load Models**
   - Click "Open .glb"
   - Select architecture model → Assign "Architecture"
   - Select MEP model → Assign "Mechanical"
   - Models load and display

2. **Open Clash Viewer**
   - Click "🔍 Clashes" button at bottom-right
   - First clash appears: "Pipe.1.10 is inside Duct.2.6"

3. **Review Clash 1**
   - Read description and AI analysis
   - Observe highlighted components (green pipe, purple duct)
   - Orbiting camera to inspect from different angles
   - AI says: "Hard Clash - High Confidence"

4. **Navigate to Next**
   - Click "Next" or press `→`
   - Clash 2 appears: "Duct.1.7 clashes with Duct.1.4"
   - Camera auto-focuses on new location

5. **Show Context**
   - Click "👁️ Show All" to see surrounding elements
   - Assess impact on nearby components
   - Continue review

6. **Complete Review**
   - Navigate through all 20 clashes
   - Note relevant hard clashes for resolution
   - Close viewer when done

---

## 🎯 Best Practices

### **For Clash Reviewers**

1. ✅ **Review systematically**: Go through clashes in order
2. ✅ **Use AI insights**: Let GPT-4V analysis guide your focus
3. ✅ **Inspect angles**: Orbit around each clash to understand the issue
4. ✅ **Note patterns**: Look for repeated issues (e.g., all pipes in slabs)
5. ✅ **Context matters**: Use "Show All" to understand spatial relationships

### **For Developers**

1. ✅ **Keep CSV updated**: Regenerate after model changes
2. ✅ **Validate GUIDs**: Ensure GUIDs in CSV match model GUIDs
3. ✅ **Test thoroughly**: Verify all navigation and visibility features
4. ✅ **Monitor performance**: Large models may need optimization
5. ✅ **Document changes**: Update this guide when adding features

---

## 🌟 Advanced Features

### **Keyboard Navigation**

Power users can navigate entirely by keyboard:
```
Space           → Open clash viewer
Left Arrow      → Previous clash
Right Arrow     → Next clash
Escape          → Close viewer
```

### **Console Commands**

Debug and control clashes from the browser console:
```javascript
// Manually open clash viewer
clashCardManager.showCard();

// Get clash count
clashCardManager.getClashCount();

// Check if loaded
clashCardManager.hasClashes();

// Reload with different file
clashCardManager.loadClashesFromCSV('/new-clashes.csv');
```

---

## 📊 Performance Notes

### **Large Clash Lists**

- The viewer handles 100+ clashes efficiently
- Navigation is instant (no re-rendering delay)
- GUID lookups are optimized with scene traversal
- Card content is generated on-demand

### **Complex Models**

- Auto-hide mode improves performance
- Highlighting uses minimal overhead (overlay meshes)
- Camera animations use requestAnimationFrame
- Memory efficient (no duplicate geometries)

---

## 🎉 Summary

The Clash Detection Viewer provides a **professional, high-tech interface** for reviewing BIM clash detection results. With:

✅ **Automated highlighting** of clashing objects  
✅ **AI-powered analysis** from GPT-4V  
✅ **Intuitive navigation** with keyboard shortcuts  
✅ **Modern design** that's visually appealing  
✅ **Developer-friendly** with console access  

It's designed to make clash coordination **faster, clearer, and more effective**! 🚀

---

## 📚 Related Documentation

- [Camera Controls Guide](CAMERA_CONTROLS_GUIDE.md) - Adjust camera parameters
- [Surrounding Objects Guide](SURROUNDING_OBJECTS_GUIDE.md) - Hide/transparent modes
- [Refactoring Update](REFACTORING_UPDATE.md) - Multi-file loading
- [README](README.md) - General project overview



