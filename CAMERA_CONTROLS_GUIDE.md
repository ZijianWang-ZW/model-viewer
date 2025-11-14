# 📷 Camera Focus Controls Guide

Complete guide to controlling the camera when focusing on objects via GUID search.

---

# 📷 Camera Controls Quick Start

## 🎯 **Console Commands** (Press F12)

### **1. Check Current Settings**
```javascript
debugViewer.getCameraConfig()
```

### **2. Adjust Zoom**
```javascript
// Closer (0.5 - 1.5)
debugViewer.setCameraConfig({ distanceMultiplier: 1.0 })

// Farther (1.5 - 5.0)
debugViewer.setCameraConfig({ distanceMultiplier: 3.0 })
```

### **3. Change View Angle**
```javascript
// Top view (bird's eye)
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 1, z: 0 } })

// Front view
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 0, z: 1 } })

// Isometric (default)
debugViewer.setCameraConfig({ viewAngle: { x: 1, y: 1, z: 1 } })
```

### **4. Adjust Focus Point**
```javascript
// Shift up/down
debugViewer.setCameraConfig({ verticalOffset: 5 })

// Shift left/right
debugViewer.setCameraConfig({ horizontalOffset: -3 })
```

### **5. Toggle Animation**
```javascript
// Smooth animation (default)
debugViewer.setCameraConfig({ animated: true })

// Instant jump
debugViewer.setCameraConfig({ animated: false })
```

### **6. Reset to Defaults**
```javascript
debugViewer.resetCameraConfig()
```

---

## 📋 **Common Combinations**

### Close-up Top View
```javascript
debugViewer.setCameraConfig({
  viewAngle: { x: 0, y: 1, z: 0 },
  distanceMultiplier: 1.0
})
```

### Wide Isometric
```javascript
debugViewer.setCameraConfig({
  viewAngle: { x: 1, y: 1, z: 1 },
  distanceMultiplier: 2.5
})
```

### Front Elevation
```javascript
debugViewer.setCameraConfig({
  viewAngle: { x: 0, y: 0, z: 1 },
  distanceMultiplier: 1.5
})
```



## 🎛️ **Adjustable Parameters**

### 1. **Distance Multiplier** 
**Control how far/close the camera is from objects**

- **Parameter:** `distanceMultiplier`
- **Type:** `number`
- **Default:** `1.5`
- **Range:** `0.5` to `5.0` (recommended)
- **Effect:** 
  - **Lower values** (0.5-1.0) = Closer zoom, more detail
  - **Higher values** (2.0-5.0) = Farther away, more context

---

### 2. **View Angle** 
**Control the camera viewing direction**

- **Parameter:** `viewAngle`
- **Type:** `{ x: number, y: number, z: number }`
- **Default:** `{ x: 1, y: 1, z: 1 }` (Isometric 45°)
- **Common Presets:**

| View Name | x | y | z | Description |
|-----------|---|---|---|-------------|
| **Isometric** | 1 | 1 | 1 | Default diagonal view (45°, 45°, 45°) |
| **Front** | 0 | 0 | 1 | Looking from front (Z-axis) |
| **Back** | 0 | 0 | -1 | Looking from back |
| **Top** | 0 | 1 | 0 | Bird's eye view (from above) |
| **Bottom** | 0 | -1 | 0 | Looking from below |
| **Left** | -1 | 0 | 0 | Looking from left side |
| **Right** | 1 | 0 | 0 | Looking from right side |
| **Top-Front** | 0 | 1 | 1 | 45° from front, elevated |
| **Top-Back** | 0 | 1 | -1 | 45° from back, elevated |

---

### 3. **Animation** 
**Control smooth camera movement**

- **Parameter:** `animated`
- **Type:** `boolean`
- **Default:** `true`
- **Effect:**
  - `true` = Smooth animated camera movement
  - `false` = Instant jump to position

---

### 4. **Vertical Offset** 
**Shift camera focus point up/down**

- **Parameter:** `verticalOffset`
- **Type:** `number` (world units)
- **Default:** `0`
- **Effect:**
  - **Positive values** = Focus point shifts UP
  - **Negative values** = Focus point shifts DOWN
  - Example: `verticalOffset: 2` raises focus by 2 units

---

### 5. **Horizontal Offset** 
**Shift camera focus point left/right**

- **Parameter:** `horizontalOffset`
- **Type:** `number` (world units)
- **Default:** `0`
- **Effect:**
  - **Positive values** = Focus point shifts RIGHT (X+)
  - **Negative values** = Focus point shifts LEFT (X-)

---

## 🖥️ **Console Commands**

Open browser DevTools console (F12) and use these commands:

### **View Current Configuration**
```javascript
debugViewer.getCameraConfig()
```
Output shows current settings in a table format.

---

### **Change Single Parameter**
```javascript
// Zoom closer
debugViewer.setCameraConfig({ distanceMultiplier: 1.0 })

// Zoom farther
debugViewer.setCameraConfig({ distanceMultiplier: 3.0 })

// Change to top view
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 1, z: 0 } })

// Change to front view
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 0, z: 1 } })

// Disable animation (instant jump)
debugViewer.setCameraConfig({ animated: false })

// Shift focus point up by 5 units
debugViewer.setCameraConfig({ verticalOffset: 5 })
```

---

### **Change Multiple Parameters at Once**
```javascript
// Top view with closer zoom
debugViewer.setCameraConfig({
  viewAngle: { x: 0, y: 1, z: 0 },
  distanceMultiplier: 1.2
})

// Isometric view with offset and slow animation
debugViewer.setCameraConfig({
  viewAngle: { x: 1, y: 1, z: 1 },
  distanceMultiplier: 2.0,
  verticalOffset: 3,
  animated: true
})
```

---

### **Reset to Defaults**
```javascript
debugViewer.resetCameraConfig()
```

---

## 📋 **Common Use Cases**

### **Scenario 1: View Small Object (Zoom In Close)**
```javascript
debugViewer.setCameraConfig({ distanceMultiplier: 0.8 })
```

### **Scenario 2: View Large Building (Zoom Out)**
```javascript
debugViewer.setCameraConfig({ distanceMultiplier: 3.5 })
```

### **Scenario 3: Top-Down View for Floor Plans**
```javascript
debugViewer.setCameraConfig({
  viewAngle: { x: 0, y: 1, z: 0 },
  distanceMultiplier: 2.0
})
```

### **Scenario 4: Front Elevation View**
```javascript
debugViewer.setCameraConfig({
  viewAngle: { x: 0, y: 0, z: 1 },
  distanceMultiplier: 1.5
})
```

### **Scenario 5: Focus on Upper Part of Object**
```javascript
debugViewer.setCameraConfig({
  verticalOffset: 5,
  distanceMultiplier: 1.5
})
```

### **Scenario 6: Quick Jump (No Animation)**
```javascript
debugViewer.setCameraConfig({ animated: false })
// Search for GUID - will jump instantly
// Then turn animation back on:
debugViewer.setCameraConfig({ animated: true })
```

---

## 🎨 **Workflow Example**

1. **Load your model and search for a GUID:**
```javascript
// Search for object
debugViewer.searchGUID("0gjFHjjvD7S8kZrgPA3y2Z")
```

2. **If view is not ideal, adjust camera:**
```javascript
// Try closer zoom
debugViewer.setCameraConfig({ distanceMultiplier: 1.0 })

// Re-search to apply new camera settings
debugViewer.searchGUID("0gjFHjjvD7S8kZrgPA3y2Z")
```

3. **Try different angles:**
```javascript
// Top view
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 1, z: 0 } })
debugViewer.searchGUID("0gjFHjjvD7S8kZrgPA3y2Z")

// Front view
debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 0, z: 1 } })
debugViewer.searchGUID("0gjFHjjvD7S8kZrgPA3y2Z")

// Back to isometric
debugViewer.resetCameraConfig()
debugViewer.searchGUID("0gjFHjjvD7S8kZrgPA3y2Z")
```

---

## 🔧 **Programmatic API**

If you're integrating this into code, use the Viewer API directly:

```typescript
// Get config
const config = viewer.getCameraFocusConfig();

// Set config
viewer.setCameraFocusConfig({
  distanceMultiplier: 2.0,
  viewAngle: { x: 1, y: 1, z: 1 },
  animated: true,
  verticalOffset: 0,
  horizontalOffset: 0
});

// Reset
viewer.resetCameraFocusConfig();
```

---

## 📊 **Parameter Reference Table**

| Parameter | Type | Default | Range/Options | Impact |
|-----------|------|---------|---------------|--------|
| `distanceMultiplier` | `number` | 1.5 | 0.5 - 5.0 | Camera distance from object |
| `viewAngle.x` | `number` | 1 | -5 to 5 | Horizontal angle component |
| `viewAngle.y` | `number` | 1 | -5 to 5 | Vertical angle component |
| `viewAngle.z` | `number` | 1 | -5 to 5 | Depth angle component |
| `animated` | `boolean` | true | true/false | Smooth vs instant camera move |
| `verticalOffset` | `number` | 0 | -100 to 100 | Focus point vertical shift |
| `horizontalOffset` | `number` | 0 | -100 to 100 | Focus point horizontal shift |

---

## 💡 **Tips**

1. **Start with defaults** and adjust one parameter at a time
2. **Use `getCameraConfig()`** frequently to see current values
3. **Combine view angles** for custom perspectives (e.g., `{ x: 1, y: 0.5, z: 1 }`)
4. **Adjust offsets** if object's important features are off-center
5. **Turn off animation** for rapid testing of multiple GUIDs
6. **Save your favorite presets** in a text file for reuse

---

## 🐛 **Troubleshooting**

### Camera too close/far?
```javascript
// Adjust distance multiplier
debugViewer.setCameraConfig({ distanceMultiplier: 2.5 })
```

### Can't see the object?
```javascript
// Reset to defaults first
debugViewer.resetCameraConfig()
// Then search again
debugViewer.searchGUID("your-guid-here")
```

### Object is off-center in view?
```javascript
// Adjust offsets
debugViewer.setCameraConfig({
  verticalOffset: 2,    // Shift up
  horizontalOffset: -1  // Shift left
})
```

### Camera jerky during movement?
```javascript
// Ensure animation is enabled
debugViewer.setCameraConfig({ animated: true })
```

---

## 📞 **Quick Reference**

**Most common commands:**
```javascript
debugViewer.getCameraConfig()                          // Check current settings
debugViewer.setCameraConfig({ distanceMultiplier: X }) // Change zoom (X = 0.5 to 5.0)
debugViewer.setCameraConfig({ viewAngle: {x,y,z} })    // Change angle
debugViewer.resetCameraConfig()                        // Reset to defaults
```

**After changing config, re-search to see effect:**
```javascript
debugViewer.searchGUID("your-guid")
```

