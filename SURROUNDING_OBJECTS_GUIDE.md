# 👁️ Surrounding Objects Control

Control visibility and transparency of unselected objects for better clash inspection.

---

## 🎯 **Two Modes**

After highlighting objects with GUID search, you can control surrounding objects:

### **1. Hide Others** 🚫
**Hides all unselected objects** - Only highlighted objects are visible.

- **Button:** "Hide Others" (red when active)
- **Use Case:** Focus exclusively on clash components
- **Effect:** All other objects become invisible

### **2. Transparent Others** 👻
**Makes unselected objects semi-transparent** (15% opacity)

- **Button:** "Transparent Others" (cyan when active)
- **Use Case:** See clash context while maintaining visibility of surrounding structure
- **Effect:** Other objects become 85% transparent

---

## 🖥️ **How to Use**

### **Step 1: Search for Objects**
```javascript
// In UI: Enter GUIDs and click Focus
"guid1, guid2"

// Or in console:
debugViewer.searchGUID("guid1, guid2")
```

**Result:** Objects highlighted with colors (green, purple, etc.)

---

### **Step 2: Choose Viewing Mode**

**Option A: Hide Others (Isolate View)**
- Click **"Hide Others"** button
- Button turns **red**
- All unselected objects disappear
- Only highlighted objects visible

**Option B: Transparent Others (Context View)**
- Click **"Transparent Others"** button
- Button turns **cyan**
- Unselected objects become 85% transparent
- Highlighted objects remain opaque and colorful

---

### **Step 3: Return to Normal**
- Click the active button again (red or cyan)
- Returns to normal view
- All objects restored to original state

---

## 📋 **Usage Examples**

### **Example 1: Clash Detection - Isolated View**

**Scenario:** Two pipes clash, need to see ONLY the conflicting pipes.

```javascript
// 1. Search for both pipe GUIDs
debugViewer.searchGUID("pipe1_guid, pipe2_guid")
// Result: Pipe 1 = Green, Pipe 2 = Purple

// 2. Click "Hide Others" button
// Result: Only the two pipes visible, everything else hidden
```

**Visual:**
```
Before: [Building] [Walls] [Floors] [Pipes] [Systems]
After:  [Pipe1🟢] [Pipe2🟣]
```

---

### **Example 2: Clash Detection - Context View**

**Scenario:** See clash but also need surrounding structure for context.

```javascript
// 1. Search for clash components
debugViewer.searchGUID("beam_guid, duct_guid")
// Result: Beam = Green, Duct = Purple

// 2. Click "Transparent Others" button
// Result: Beam + Duct bright and opaque, building 85% transparent
```

**Visual:**
```
Before: [Walls] [Floors] [Beam] [Duct] [Columns] (all opaque)
After:  [Walls👻] [Floors👻] [Beam🟢] [Duct🟣] [Columns👻]
        (15% opacity)     (100% opaque)    (15% opacity)
```

---

### **Example 3: Multiple Issues Review**

**Scenario:** Review 3 separate clashes at once.

```javascript
// 1. Search for all clash objects
debugViewer.searchGUID("guid1, guid2, guid3, guid4, guid5, guid6")
// Result: 6 objects with different colors

// 2. Hide Others
// Result: Only 6 clash objects visible

// 3. Adjust camera to see all
debugViewer.setCameraConfig({ distanceMultiplier: 3.0 })
```

---

## 🎨 **Button States**

### **"Hide Others" Button**
| State | Color | Text | Effect |
|-------|-------|------|--------|
| **Inactive** | Gray | "Hide Others" | Normal view |
| **Active** | 🔴 Red | "Hide Others" | Unselected hidden |

### **"Transparent Others" Button**
| State | Color | Text | Effect |
|-------|-------|------|--------|
| **Inactive** | Gray | "Transparent Others" | Normal view |
| **Active** | 🔵 Cyan | "Transparent Others" | Unselected transparent |

---

## 💡 **When to Use Each Mode**

### **Use "Hide Others" When:**
✅ Analyzing specific clash geometry  
✅ Taking screenshots of isolated issues  
✅ Measuring distances between components  
✅ Need absolute clarity without distractions  
✅ Presenting issues to stakeholders  

### **Use "Transparent Others" When:**
✅ Understanding spatial context  
✅ Checking if clash affects nearby elements  
✅ Verifying clearances and accessibility  
✅ Seeing relationship to building structure  
✅ Understanding system routing  

---

## 🔧 **Technical Details**

### **Hide Mode:**
- Sets `mesh.visible = false` on unselected objects
- Stores original visibility state
- Completely removes objects from rendering
- **Performance:** ✅ Faster rendering (fewer objects)

### **Transparent Mode:**
- Clones material for each unselected object
- Sets `opacity = 0.15` (85% transparent)
- Sets `transparent = true`
- Sets `depthWrite = false` (prevents z-fighting)
- **Performance:** ⚠️ Slightly slower (more draw calls)

### **Restoration:**
- Original materials and visibility stored in Maps
- Cloned materials disposed properly
- No memory leaks
- Instant restoration when deactivating

---

## 🎯 **Workflow Integration**

### **Typical Clash Review Workflow:**

1. **Load models** (Architecture, MEP, Structure)
2. **Read clash CSV** → Get component GUIDs
3. **Search for clash pair:**
   ```javascript
   debugViewer.searchGUID("comp1_guid, comp2_guid")
   ```
4. **Choose viewing mode:**
   - **Quick analysis?** → Hide Others
   - **Need context?** → Transparent Others
5. **Adjust camera if needed:**
   ```javascript
   debugViewer.setCameraConfig({ distanceMultiplier: 1.5 })
   ```
6. **Take screenshot / analyze**
7. **Move to next clash** → Search new GUIDs
8. **Previous view restored automatically**

---

## 🚨 **Important Notes**

### **⚠️ Must Search First**
Buttons only work AFTER searching for GUIDs. If no objects selected:
```
Console: [GuidController] No objects selected. Search for GUIDs first.
```

### **⚠️ Mutually Exclusive**
Only one mode can be active at a time:
- Clicking "Hide Others" → Disables "Transparent Others"
- Clicking "Transparent Others" → Disables "Hide Others"

### **⚠️ Auto-Restore**
Clearing GUID highlights automatically restores all objects:
- Click "Find by GUID: On" to toggle off
- Both buttons reset automatically

---

## 🖥️ **Console Commands**

### **Check Current Mode**
```javascript
viewer.getSurroundingMode()
// Returns: 'normal' | 'hidden' | 'transparent'
```

### **Set Mode Programmatically**
```javascript
// Hide unselected
viewer.setSurroundingMode('hidden')

// Make transparent
viewer.setSurroundingMode('transparent')

// Return to normal
viewer.setSurroundingMode('normal')
```

---

## 📊 **Comparison**

| Feature | Hide Others | Transparent Others | Normal |
|---------|-------------|-------------------|---------|
| **Highlighted Objects** | 🟢 Opaque + Colored | 🟢 Opaque + Colored | 🟢 Opaque + Colored |
| **Unselected Objects** | 🚫 Hidden | 👻 15% opacity | ✅ Normal |
| **Context Visibility** | ❌ No | ✅ Yes | ✅ Yes |
| **Focus Level** | 🎯 Maximum | ⚖️ Balanced | 👁️ None |
| **Performance** | ⚡ Best | ✅ Good | ✅ Good |
| **Use Case** | Isolation | Context | General |

---

## 💪 **Pro Tips**

1. **Start with Transparent Others** to understand context, then switch to Hide Others for detailed analysis
2. **Use Hide Others for screenshots** - cleaner presentation
3. **Combine with camera presets:**
   ```javascript
   // Top view + hide others
   debugViewer.setCameraConfig({ viewAngle: { x: 0, y: 1, z: 0 } })
   // Then click "Hide Others"
   ```
4. **Toggle quickly** - both buttons act as toggles (click again to deactivate)
5. **Works with multiple objects** - useful for reviewing several clashes at once

---

## 🐛 **Troubleshooting**

### **Buttons don't work?**
→ Search for GUIDs first! Buttons require selected objects.

### **Can't see any objects?**
→ Click the active button again to return to normal view.

### **Transparent mode looks wrong?**
→ Might be GPU/driver issue. Try "Hide Others" instead.

### **Want to reset everything?**
```javascript
// Clear highlights and restore all
viewer.clearGuidHighlights()
```

---

## 🎉 **Quick Reference**

**Workflow:**
1. Search GUIDs → Objects highlighted in colors
2. Click **"Hide Others"** (red) → Only highlighted visible
3. Or click **"Transparent Others"** (cyan) → Others 85% transparent
4. Click again → Return to normal

**Console:**
```javascript
viewer.getSurroundingMode()          // Check current mode
viewer.setSurroundingMode('hidden')   // Hide others
viewer.setSurroundingMode('transparent') // Transparent others
viewer.setSurroundingMode('normal')   // Restore normal
```

Perfect for BIM clash detection and analysis! 🚀

