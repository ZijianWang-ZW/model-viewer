# Product Requirements Document (PRD)
## Enhanced 3D Model Viewer with Clash Detection

---

## 1. Executive Summary

This document outlines the technical requirements and implementation strategy for enhancing the existing GLB model viewer with four key features:
1. Multi-model loading and management
2. GUID-based object highlighting
3. Smart camera positioning for selected objects
4. Clash detection visualization from CSV data

**Target Users**: BIM coordinators, architects, engineers working with IFC/BIM models  
**Primary Use Case**: Visualizing and reviewing clash detection results in 3D context

---

## 2. Current System Analysis

### 2.1 Existing Architecture
- **Framework**: Three.js + @thatopen/components (BIM-focused)
- **Key Features**:
  - Single model loading (GLB format)
  - Mesh batching for performance optimization
  - Edge overlay rendering
  - Text-based search and highlighting
  - Clipping plane manipulation
  - Adaptive resolution during interaction
  - Frustum culling for large models

### 2.2 Current Limitations
- ❌ Only one model loaded at a time
- ❌ No GUID-based object selection
- ❌ No automatic camera positioning for objects
- ❌ No clash detection visualization capabilities
- ❌ No CSV data integration

---

## 3. Feature Specifications

### 3.1 Feature 1: Multi-Model Management

#### 3.1.1 Functional Requirements
- **FR1.1**: Support loading multiple GLB files simultaneously
- **FR1.2**: Each model must have independent visibility control
- **FR1.3**: Provide "Show All" / "Hide All" bulk operations
- **FR1.4**: Maintain separate batching state per model
- **FR1.5**: Display model list with names and status indicators

#### 3.1.2 Technical Approach
- **Data Structure**: Create `ModelManager` class to track loaded models
- **Storage**: Map-based registry with unique model IDs
- **Rendering**: Each model in separate Three.js Group for isolation
- **Batching**: Per-model batching to maintain independence
- **Memory**: Implement proper disposal when removing models

#### 3.1.3 UI Components
```
Models Panel (Collapsible Sidebar):
├── Model 1 [✓] [👁️] [🗑️]
├── Model 2 [✓] [👁️] [🗑️]
├── Model 3 [ ] [👁️] [🗑️]
└── [Show All] [Hide All] [+ Add Model]
```

#### 3.1.4 Implementation Steps
1. Refactor `Viewer.loadGLBFromFile()` to not clear previous models
2. Create `ModelManager` class in new file `src/modelManager.ts`
3. Add model metadata tracking (id, name, root, batching, visibility)
4. Implement visibility toggle logic
5. Update UI in `index.html` and `main.ts`
6. Test with 2-3 models simultaneously

---

### 3.2 Feature 2: GUID-Based Highlighting

#### 3.2.1 Functional Requirements
- **FR2.1**: Accept single or multiple GUIDs for highlighting
- **FR2.2**: Support IFC GUID format (base64-encoded, 22 characters)
- **FR2.3**: Work with both batched and unbatched meshes
- **FR2.4**: Display count of found vs. requested GUIDs
- **FR2.5**: Maintain existing name-based highlighting functionality

#### 3.2.2 Technical Approach
- **GUID Matching**: Check multiple userData properties:
  - `userData.guid`
  - `userData.GlobalId`
  - `userData.expressID`
  - Component GUID from CSV data
- **Caching Strategy**: Build GUID → Mesh lookup map on demand
- **Batching Integration**: Use existing `mergedRanges` metadata
- **Performance**: Index GUIDs once, reuse for multiple queries

#### 3.2.3 Data Flow
```
User Input (GUIDs)
    ↓
Parse & Validate
    ↓
Search all loaded models
    ↓
Find matching meshes/ranges
    ↓
Apply highlight overlay
    ↓
Report found/not-found count
```

#### 3.2.4 Implementation Steps
1. Extend `HighlightController` with `highlightByGUIDs()` method
2. Create GUID parsing utilities (handle different formats)
3. Implement mesh traversal with GUID matching
4. Cache GUID mappings for performance
5. Add UI input field for GUID entry (comma-separated)
6. Display feedback (X of Y objects found)
7. Test with GUIDs from clash CSV

---

### 3.3 Feature 3: Smart Camera Positioning

#### 3.3.1 Functional Requirements
- **FR3.1**: Auto-focus camera on highlighted objects
- **FR3.2**: Support manual "Focus Selected" button
- **FR3.3**: Smooth camera animations (optional, can be instant)
- **FR3.4**: Maintain appropriate viewing distance and angle
- **FR3.5**: Provide "Reset Camera" to return to full model view

#### 3.3.2 Technical Approach
- **Bounding Box Calculation**: Compute AABB of target objects
- **Camera Distance**: Calculate based on FOV and object size
- **View Angle**: Default to isometric (45° diagonal) or user preference
- **Animation**: Use `camera-controls` library's built-in transitions
- **Padding**: Add 20-30% margin around objects for context

#### 3.3.3 Camera Calculation Logic
```
1. Compute bounding box of selected objects
2. Calculate box center and size
3. Determine optimal distance: distance = size / (2 * tan(FOV/2))
4. Apply padding multiplier (1.2 - 1.3x)
5. Position camera along desired view vector
6. Set camera target to box center
7. Animate transition if enabled
```

#### 3.3.4 Implementation Steps
1. Add `focusOnObjects()` method to `Viewer` class
2. Implement bounding box calculation for mesh arrays
3. Add camera distance and position calculation
4. Integrate with existing `camera.controls.setLookAt()`
5. Create "Focus Selected" button in UI
6. Auto-trigger focus when highlighting by GUID
7. Add "Reset View" functionality
8. Test with various object sizes and positions

---

### 3.4 Feature 4: Clash Detection Visualization

#### 3.4.1 Functional Requirements
- **FR4.1**: Parse and load `clash_results_20.csv` file
- **FR4.2**: Display clashes in scrollable card list
- **FR4.3**: Show relevant clash information per card
- **FR4.4**: Click card to highlight clashing objects
- **FR4.5**: Click card to focus camera on clash location
- **FR4.6**: Filter clashes by relevance/type
- **FR4.7**: Search clashes by name or component
- **FR4.8**: Display statistics (total, relevant, types)

#### 3.4.2 CSV Data Structure
```
Key Fields:
- Issue Name: Clash description
- Issue GUID: Unique identifier
- Component GUIDs: Array of involved objects
- Consensus Relevance: Relevant | Irrelevant
- Consensus Type: Hard Clash | Soft Clash | Intentional/Tolerable
- Clash Size: Length, Width, Height, Volume
- GPT4V Reasoning: AI analysis text
- Confidence: High | Medium | Low
```

#### 3.4.3 Clash Card Design
```
┌────────────────────────────────────────────┐
│ 🔴 [Relevant] Hard Clash                   │
│ (CLG) Pipe.1.10 is inside (CLG) Duct.2.6  │
│ ─────────────────────────────────────────  │
│ Components: 2                              │
│ Size: L:7.27m W:76mm H:76mm V:0.03m³      │
│ Confidence: ⭐⭐⭐ High                      │
│                                            │
│ [👁️ Show] [🎯 Focus] [ℹ️ Details]          │
└────────────────────────────────────────────┘
```

#### 3.4.4 UI Layout
```
Page Layout:
┌─────────────────────────────────────────┐
│ Toolbar (existing)                      │
├────────────┬────────────────────────────┤
│            │                            │
│  Clash     │     3D Viewer              │
│  Panel     │     (canvas)               │
│  (new)     │                            │
│            │                            │
│  - Cards   │                            │
│  - Filter  │                            │
│  - Search  │                            │
│  - Stats   │                            │
│            │                            │
├────────────┴────────────────────────────┤
│ Stats Panel (existing)                  │
└─────────────────────────────────────────┘
```

#### 3.4.5 Implementation Steps
1. Create CSV parser module (`src/clashParser.ts`)
   - TypeScript interfaces matching CSV structure
   - Parse with proper handling of multiline descriptions
   - Validate data integrity
   
2. Create Clash Card UI component (`src/clashCards.ts`)
   - Card rendering logic
   - Event handlers for interactions
   - Filter and search functionality
   
3. Update HTML structure
   - Add clash panel container
   - Style with CSS (match existing dark theme)
   - Responsive layout adjustments
   
4. Integrate with highlighting system
   - Parse component GUIDs from CSV
   - Call `highlightByGUIDs()` on card click
   - Clear highlights on deselect
   
5. Integrate with camera system
   - Calculate clash location from component positions
   - Auto-focus camera on card click
   - Provide appropriate viewing angle
   
6. Add filtering capabilities
   - Filter by relevance (Relevant/Irrelevant)
   - Filter by type (Hard/Soft/Tolerable)
   - Filter by confidence level
   - Combine multiple filters
   
7. Add search functionality
   - Search by issue name
   - Search by component name
   - Real-time filter as user types
   
8. Display statistics
   - Total clash count
   - Count by relevance
   - Count by type
   - Count by confidence

---

## 4. Technical Architecture

### 4.1 New File Structure
```
src/
├── viewer/
│   └── Viewer.ts (modified)
├── modelManager.ts (NEW)
├── clashParser.ts (NEW)
├── clashCards.ts (NEW)
├── guidUtils.ts (NEW)
├── highlight.ts (modified)
├── main.ts (modified)
└── style.css (modified)

public/
└── clash_results_20.csv (existing)
```

### 4.2 Key Data Structures

#### ModelData Interface
```typescript
interface ModelData {
  id: string;
  name: string;
  root: THREE.Group;
  batching: BatchingResult | null;
  visible: boolean;
  filePath: string;
  loadedAt: Date;
}
```

#### ClashData Interface
```typescript
interface ClashData {
  issueName: string;
  issueGuid: string;
  description: string;
  componentGuids: string[];
  componentNames: string[];
  componentTypes: string[];
  relevance: 'Relevant' | 'Irrelevant';
  type: string;
  size: {
    length: string;
    width: string;
    height: string;
    volume: string;
  };
  reasoning: string;
  confidence: 'High' | 'Medium' | 'Low';
}
```

### 4.3 API Methods (New/Modified)

#### Viewer Class Extensions
- `loadAdditionalModel(file: File, name?: string): Promise<string>` - Returns model ID
- `removeModel(modelId: string): void`
- `setModelVisibility(modelId: string, visible: boolean): void`
- `getLoadedModels(): ModelData[]`
- `highlightByGUIDs(guids: string[], modelId?: string): void`
- `focusOnObjects(meshes: THREE.Mesh[], animated?: boolean): void`
- `focusOnBoundingBox(box: THREE.Box3, animated?: boolean): void`

#### ClashManager Class (New)
- `loadClashData(csvPath: string): Promise<ClashData[]>`
- `getClashByGuid(guid: string): ClashData | null`
- `filterClashes(criteria: FilterCriteria): ClashData[]`
- `getStatistics(): ClashStats`

---

## 5. Implementation Phases

### Phase 1: Multi-Model Support (Priority: HIGH)
**Duration**: 2-3 days  
**Deliverables**:
- ✅ ModelManager class implementation
- ✅ Modified Viewer to support multiple models
- ✅ UI for model list and visibility controls
- ✅ Test with 2-3 sample models

### Phase 2: GUID Highlighting (Priority: HIGH)
**Duration**: 2 days  
**Deliverables**:
- ✅ Extended HighlightController with GUID support
- ✅ GUID parsing and validation utilities
- ✅ UI input field and feedback display
- ✅ Test with GUIDs from clash CSV

### Phase 3: Camera Control (Priority: MEDIUM)
**Duration**: 1-2 days  
**Deliverables**:
- ✅ Camera positioning methods in Viewer
- ✅ Integration with highlighting system
- ✅ UI buttons for focus and reset
- ✅ Test with various object configurations

### Phase 4: Clash Visualization (Priority: HIGH)
**Duration**: 3-4 days  
**Deliverables**:
- ✅ CSV parser with full data validation
- ✅ Clash card UI components
- ✅ Filter and search functionality
- ✅ Integration with highlighting and camera
- ✅ Statistics display
- ✅ Complete end-to-end testing

### Phase 5: Polish & Documentation (Priority: MEDIUM)
**Duration**: 1-2 days  
**Deliverables**:
- ✅ Performance optimization
- ✅ UI/UX refinements
- ✅ Error handling improvements
- ✅ User documentation
- ✅ Code documentation

---

## 6. Technical Considerations

### 6.1 Performance Optimization
- **GUID Lookup**: Build index once, cache results
- **Clash Rendering**: Virtualize card list for 100+ clashes
- **Multi-Model**: Independent batching per model
- **Camera Animation**: Use requestAnimationFrame for smooth transitions

### 6.2 Error Handling
- **Invalid GUIDs**: Show user-friendly error messages
- **Missing Objects**: Report which GUIDs couldn't be found
- **CSV Parsing**: Handle malformed data gracefully
- **Model Loading**: Display progress and handle failures

### 6.3 Browser Compatibility
- **Target**: Modern browsers (Chrome, Firefox, Edge, Safari)
- **WebGL**: WebGL2 preferred, fallback to WebGL1
- **File API**: Use standard File API for local file loading

### 6.4 Data Validation
- **CSV Format**: Validate header row matches expected structure
- **GUID Format**: Accept 22-character base64 IFC GUIDs
- **Component Data**: Handle missing or null values gracefully

---

## 7. Testing Strategy

### 7.1 Unit Testing
- GUID parsing and validation
- CSV parser with various data formats
- Bounding box calculations
- Filter and search logic

### 7.2 Integration Testing
- Multi-model loading and visibility toggling
- GUID highlighting across multiple models
- Camera focus with different object configurations
- Clash card interactions with 3D viewer

### 7.3 User Acceptance Testing
- Load sample BIM models (2-3 models)
- Verify all 20 clashes from CSV are accessible
- Test filtering and search functionality
- Validate camera positioning quality
- Performance with typical model sizes

### 7.4 Performance Testing
- Load time with 3 models simultaneously
- Highlighting performance with 50+ objects
- Clash list scrolling with 100+ items
- Memory usage with extended sessions

---

## 8. Success Metrics

### 8.1 Functional Metrics
- ✅ Successfully load 3+ models without performance degradation
- ✅ Highlight objects by GUID with <100ms response time
- ✅ Camera auto-focus positions objects within viewport
- ✅ Display all clashes from CSV with full metadata
- ✅ Filter and search return results in <50ms

### 8.2 Usability Metrics
- ✅ Users can locate clash in 3D within 3 clicks
- ✅ Model visibility toggle is intuitive (no training needed)
- ✅ GUID highlighting works for 95%+ of valid GUIDs
- ✅ Camera framing shows complete clash context

### 8.3 Performance Metrics
- ✅ Frame rate maintained at 30+ FPS with 3 models
- ✅ Initial load time <5 seconds for typical models
- ✅ Clash panel renders in <1 second
- ✅ Memory usage <2GB for typical workflow

---

## 9. Future Enhancements (Out of Scope for v1)

### 9.1 Advanced Clash Visualization
- 3D bounding boxes at clash locations
- Color-coded clash severity heatmap
- Clash density visualization
- Animated clash "flythrough" tours

### 9.2 Model Comparison
- Side-by-side model diff view
- Highlight added/removed/changed objects
- Version control integration

### 9.3 Export and Reporting
- Export clash list to PDF/Excel
- Generate clash resolution reports
- Screenshot capture with annotations

### 9.4 Collaboration Features
- Share specific clash views via URL
- Add comments to clashes
- Mark clashes as resolved/in-progress

---

## 10. Dependencies & Prerequisites

### 10.1 Required Libraries (Already Installed)
- ✅ three.js (v0.180.0)
- ✅ @thatopen/components (v3.1.3)
- ✅ TypeScript (v5.8.3)

### 10.2 Optional Enhancements
- `papaparse` - Robust CSV parsing (consider if native parsing insufficient)
- `gsap` - Smooth camera animations (consider if native transitions insufficient)

### 10.3 Data Requirements
- GLB model files with proper IFC metadata
- CSV file with clash results (provided)
- Models must have GUIDs in userData

---

## 11. Risk Assessment

### 11.1 Technical Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| GUIDs not present in models | High | Fallback to name-based matching |
| Performance with many models | Medium | Implement lazy loading, LOD |
| CSV format variations | Low | Flexible parser with validation |
| Browser memory limits | Medium | Model disposal, memory monitoring |

### 11.2 User Experience Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Complex UI overwhelming users | Medium | Progressive disclosure, tooltips |
| Clash cards too verbose | Low | Collapsible details sections |
| Camera positioning disorienting | Low | Smooth transitions, reset button |

---

## 12. Acceptance Criteria

**Feature 1: Multi-Model Management**
- [ ] Load 3 GLB files simultaneously
- [ ] Toggle visibility for each model independently
- [ ] Show/Hide all models with single button
- [ ] Display model names in UI
- [ ] No performance degradation vs. single model

**Feature 2: GUID Highlighting**
- [ ] Accept comma-separated GUID list
- [ ] Highlight objects matching provided GUIDs
- [ ] Display count of found objects
- [ ] Work with both batched and unbatched meshes
- [ ] Clear highlights when input cleared

**Feature 3: Camera Positioning**
- [ ] Auto-focus on highlighted objects
- [ ] Manual "Focus Selected" button works
- [ ] Objects fully visible in viewport
- [ ] Appropriate viewing distance maintained
- [ ] Reset camera to full view

**Feature 4: Clash Visualization**
- [ ] Parse and display all 20 clashes from CSV
- [ ] Show relevant metadata on each card
- [ ] Click card highlights clashing objects in 3D
- [ ] Click card focuses camera on clash
- [ ] Filter by relevance/type/confidence
- [ ] Search by name/component
- [ ] Display accurate statistics

---

## 13. Documentation Deliverables

### 13.1 User Documentation
- Feature overview and quick start guide
- Model loading instructions
- GUID highlighting usage guide
- Clash review workflow
- Keyboard shortcuts reference

### 13.2 Technical Documentation
- API reference for new methods
- Data structure specifications
- Integration guide for new features
- Performance tuning guide

### 13.3 Code Documentation
- Inline comments for complex logic
- JSDoc for public methods
- Type definitions with descriptions
- Architecture decision records (ADRs)

---

## 14. Timeline & Milestones

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Phase 1-2 | Multi-model + GUID highlighting |
| 2 | Phase 3-4 | Camera control + Clash visualization |
| 3 | Phase 5 | Polish, testing, documentation |

**Total Duration**: 2-3 weeks  
**Target Completion**: End of Week 3

---

## 15. Approval & Sign-off

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Status**: ✅ Ready for Implementation

**Prepared by**: AI Development Assistant  
**Reviewed by**: [Pending]  
**Approved by**: [Pending]

---

## Appendix A: GUID Format Reference

### IFC GUID Structure
- Length: 22 characters
- Character set: Base64 (0-9, A-Z, a-z, _, $)
- Example: `1S9G5zrjz40xBsZmHlztJM`
- Encoding: Compressed from standard UUID

### Component GUID in CSV
- Format: Standard or IFC format
- Location: `Component GUID` column (array format)
- Parsing: Strip brackets and quotes, split by comma

---

## Appendix B: Clash Type Definitions

### Hard Clash
Physical overlap between components that requires resolution. Examples:
- Pipe inside duct
- Beam intersecting column
- Duct crossing structural element

### Soft Clash
Spacing violation or clearance issue. Examples:
- Insufficient maintenance clearance
- Access pathway blocked
- Fire rating zone violation

### Intentional/Tolerable Clash
Acceptable overlap within tolerance. Examples:
- Pipe penetration through slab (designed)
- MEP sleeve through wall
- Small overlap within tolerance threshold

---

**End of PRD**

