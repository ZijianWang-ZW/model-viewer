import * as THREE from 'three';
import type { SimpleCamera } from '@thatopen/components';

export interface CameraFocusConfig {
  /** Distance multiplier from object. Higher = farther away. Default: 1.5 */
  distanceMultiplier: number;
  
  /** Camera viewing angle as vector. Default: (1,1,1) = isometric */
  viewAngle: { x: number; y: number; z: number };
  
  /** Enable smooth animation. Default: true */
  animated: boolean;
  
  /** Vertical offset from object center (in world units). Default: 0 */
  verticalOffset: number;
  
  /** Horizontal offset from object center (in world units). Default: 0 */
  horizontalOffset: number;
}

/**
 * Controller for GUID-based object search, highlighting, and camera focusing
 */
export type SurroundingMode = 'normal' | 'hidden' | 'transparent';

/**
 * Result of GUID search - can be a regular Mesh or an InstancedMesh with instance index
 */
export interface GuidMatch {
  object: THREE.Mesh | THREE.InstancedMesh;
  instanceIndex?: number; // undefined for regular Mesh, 0-based index for InstancedMesh
  globalId: string;
}

/**
 * Highlight information for tracking highlighted objects
 */
interface HighlightInfo {
  originalObject: THREE.Mesh | THREE.InstancedMesh;
  highlightMesh: THREE.Mesh; // Highligh overlay
  instanceIndex?: number; // undefined for regular Mesh
}

export class GuidController {
  private scene: THREE.Scene;
  private camera: SimpleCamera;
  
  private guidSelectedMeshes: THREE.Mesh[] = [];
  private guidHighlightOverlays: THREE.Mesh[] = [];
  private guidMatches: GuidMatch[] = []; // Store GUID matches with instance info
  private highlightInfos: HighlightInfo[] = []; // Store highlight info for cleanup

  // Surrounding objects control
  private surroundingMode: SurroundingMode = 'normal';
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private originalVisibility = new Map<THREE.Mesh, boolean>();

  // Camera focus configuration
  private focusConfig: CameraFocusConfig = {
    distanceMultiplier: 1.5,
    viewAngle: { x: 1, y: 1, z: 1 }, // Isometric view (45°, 45°, 45°)
    animated: true,
    verticalOffset: 0,
    horizontalOffset: 0
  };

  constructor(scene: THREE.Scene, camera: SimpleCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Get current camera focus configuration
   */
  getCameraFocusConfig(): CameraFocusConfig {
    return { ...this.focusConfig };
  }

  /**
   * Update camera focus configuration (partial update supported)
   */
  setCameraFocusConfig(config: Partial<CameraFocusConfig>): void {
    this.focusConfig = { ...this.focusConfig, ...config };
  }

  /**
   * Reset camera focus configuration to defaults
   */
  resetCameraFocusConfig(): void {
    this.focusConfig = {
      distanceMultiplier: 1.5,
      viewAngle: { x: 1, y: 1, z: 1 },
      animated: true,
      verticalOffset: 0,
      horizontalOffset: 0
    };
  }

  /**
   * Find meshes by GUIDs across all loaded models
   * Supports both regular Meshes and InstancedMesh with GPU instancing
   */
  findMeshesByGUIDs(guids: string[]): THREE.Mesh[] {
    const matches = this.findGuidMatches(guids);
    
    // Convert GuidMatch[] to Mesh[] for backward compatibility
    // For InstancedMesh, we'll create proxy objects or handle separately in highlighting
    const foundMeshes: THREE.Mesh[] = [];
    const seenObjects = new Set<THREE.Mesh | THREE.InstancedMesh>();
    
    matches.forEach(match => {
      if (!seenObjects.has(match.object)) {
        seenObjects.add(match.object);
        // For InstancedMesh, we still add it to the list
        // Highlighting logic will handle the instance index separately
        foundMeshes.push(match.object as THREE.Mesh);
      }
    });
    
    return foundMeshes;
  }

  /**
   * Find GUID matches with full information (including instance indices)
   */
  private findGuidMatches(guids: string[]): GuidMatch[] {
    const guidSet = new Set(guids.map(g => g.trim().toLowerCase()));
    const foundMatches: GuidMatch[] = [];
    
    console.log('='.repeat(60));
    console.log('[GUID Search] 🔍 Starting search...');
    console.log('[GUID Search] Input GUIDs:', guids);
    console.log('[GUID Search] Normalized (lowercase):', Array.from(guidSet));
    
    let checkedCount = 0;
    let instancedMeshCount = 0;
    let regularMeshCount = 0;
    let sampleGUIDs: string[] = [];
    
    this.scene.traverse(obj => {
      // Check for regular Mesh
      if ((obj as any).isMesh && !(obj as any).isInstancedMesh) {
        const mesh = obj as THREE.Mesh;
        if (!(mesh as any).userData?.isUserModel) return;
        if ((mesh as any).userData?.isMergedBatch) return;
        if ((mesh as any).userData?.isEdgeOverlay) return;
        
        checkedCount++;
        regularMeshCount++;
        const userData = (mesh as any).userData || {};
        
        if (sampleGUIDs.length < 3) {
          const firstGuid = userData.name || mesh.name || userData.GlobalId;
          if (firstGuid) sampleGUIDs.push(String(firstGuid));
        }
        
        const possibleGuids = [
          userData.name,
          mesh.name,
          userData.guid,
          userData.GlobalId,
          userData.expressID,
          userData.ifcGuid,
          userData.GUID,
          userData.globalId // lowercase variant
        ].filter(Boolean).map(g => String(g).toLowerCase());
        
        for (const guid of possibleGuids) {
          if (guidSet.has(guid)) {
            console.log('[GUID Search] ✅ FOUND MATCH (Regular Mesh)!');
            console.log('  - Searched for:', guid);
            console.log('  - mesh.name:', mesh.name);
            foundMatches.push({
              object: mesh,
              globalId: guid
            });
            break;
          }
        }
      }
      
      // Check for InstancedMesh (GPU Instancing)
      if ((obj as any).isInstancedMesh) {
        const instancedMesh = obj as THREE.InstancedMesh;
        if (!(instancedMesh as any).userData?.isUserModel) return;
        if ((instancedMesh as any).userData?.isMergedBatch) return;
        if ((instancedMesh as any).userData?.isEdgeOverlay) return;
        
        checkedCount++;
        instancedMeshCount++;
        const userData = (instancedMesh as any).userData || {};
        
        // Check if this InstancedMesh has globalIds array (from GPU instancing)
        const globalIds = userData.globalIds;
        if (Array.isArray(globalIds) && globalIds.length > 0) {
          // This is a GPU instancing node - check each instance's GlobalId
          if (sampleGUIDs.length < 3 && globalIds[0]) {
            sampleGUIDs.push(String(globalIds[0]));
          }
          
          globalIds.forEach((instanceGlobalId: string, instanceIndex: number) => {
            const normalizedId = String(instanceGlobalId).toLowerCase();
            if (guidSet.has(normalizedId)) {
              console.log('[GUID Search] ✅ FOUND MATCH (InstancedMesh Instance)!');
              console.log('  - Searched for:', normalizedId);
              console.log('  - Instance index:', instanceIndex);
              console.log('  - Total instances:', globalIds.length);
              foundMatches.push({
                object: instancedMesh,
                instanceIndex: instanceIndex,
                globalId: normalizedId
              });
            }
          });
        } else {
          // Fallback: check node.name or userData.name (single instance case)
          const possibleGuids = [
            userData.name,
            instancedMesh.name,
            userData.globalId,
            userData.GlobalId
          ].filter(Boolean).map(g => String(g).toLowerCase());
          
          for (const guid of possibleGuids) {
            if (guidSet.has(guid)) {
              console.log('[GUID Search] ✅ FOUND MATCH (InstancedMesh, no instance index)!');
              console.log('  - Searched for:', guid);
              foundMatches.push({
                object: instancedMesh,
                globalId: guid
              });
              break;
            }
          }
        }
      }
    });
    
    console.log(`[GUID Search] 📊 Results:`);
    console.log(`  - Objects checked: ${checkedCount}`);
    console.log(`  - Regular meshes: ${regularMeshCount}`);
    console.log(`  - Instanced meshes: ${instancedMeshCount}`);
    console.log(`  - Matches found: ${foundMatches.length}`);
    console.log(`  - Sample GUIDs in model:`, sampleGUIDs);
    
    if (foundMatches.length === 0) {
      console.warn('[GUID Search] ⚠️ No matches found!');
      console.log('[GUID Search] 💡 Tip: Run debugViewer.listGUIDs() to see all available GUIDs');
    }
    
    console.log('='.repeat(60));
    
    return foundMatches;
  }

  /**
   * Focus camera on specific objects with configurable parameters
   * @param objects - Meshes to focus on
   * @param animated - Override animation setting (uses config if not specified)
   */
  focusOnObjects(objects: THREE.Mesh[], animated?: boolean): void {
    if (objects.length === 0) return;
    
    // Calculate bounding box of all objects
    const box = new THREE.Box3();
    objects.forEach(obj => {
      const objBox = new THREE.Box3().setFromObject(obj);
      box.union(objBox);
    });
    
    if (box.isEmpty()) return;
    
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Apply vertical and horizontal offsets
    center.y += this.focusConfig.verticalOffset;
    center.x += this.focusConfig.horizontalOffset;
    
    // Calculate distance based on camera type and config
    const camera = this.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    let distance = 10;
    if ((camera as any).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      const fov = persp.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.tan(fov / 2)) * this.focusConfig.distanceMultiplier;
    } else {
      distance = maxDim * this.focusConfig.distanceMultiplier;
    }
    
    // Calculate camera position using configured view angle
    const dir = new THREE.Vector3(
      this.focusConfig.viewAngle.x,
      this.focusConfig.viewAngle.y,
      this.focusConfig.viewAngle.z
    ).normalize();
    const eye = center.clone().add(dir.multiplyScalar(distance));
    
    // Use provided animated parameter or fall back to config
    const useAnimation = animated !== undefined ? animated : this.focusConfig.animated;
    
    this.camera.controls.setLookAt(
      eye.x, eye.y, eye.z,
      center.x, center.y, center.z,
      useAnimation
    );
  }

  /**
   * Find and focus on objects by GUIDs
   */
  findAndFocusByGUIDs(guids: string[]): { found: THREE.Mesh[], notFound: number } {
    // Get matches with full information
    this.guidMatches = this.findGuidMatches(guids);
    
    // Get unique objects for backward compatibility
    const foundMeshes = this.findMeshesByGUIDs(guids);
    
    if (foundMeshes.length > 0) {
      this.clearGuidHighlights();
      this.addGuidHighlightsFromMatches(this.guidMatches);
      
      // Create proxy meshes for focusing (handle InstancedMesh separately)
      const focusObjects = this.createFocusObjects(this.guidMatches);
      this.focusOnObjects(focusObjects, true);
      this.guidSelectedMeshes = foundMeshes;
    }
    
    return {
      found: foundMeshes,
      notFound: guids.length - this.guidMatches.length
    };
  }

  /**
   * Create focus objects from GUID matches
   * For InstancedMesh, create temporary Mesh at instance position
   */
  private createFocusObjects(matches: GuidMatch[]): THREE.Mesh[] {
    const focusObjects: THREE.Mesh[] = [];
    
    matches.forEach(match => {
      if ((match.object as any).isInstancedMesh && match.instanceIndex !== undefined) {
        const instancedMesh = match.object as THREE.InstancedMesh;
        const instanceIndex = match.instanceIndex;
        
        // Get instance transformation matrix
        const matrix = new THREE.Matrix4();
        instancedMesh.getMatrixAt(instanceIndex, matrix);
        
        // Create a temporary mesh at the instance position for focusing
        const geometry = instancedMesh.geometry;
        const material = instancedMesh.material;
        const singleMesh = new THREE.Mesh(
          geometry,
          Array.isArray(material) ? material[0] : material
        );
        singleMesh.applyMatrix4(matrix);
        singleMesh.applyMatrix4(instancedMesh.matrixWorld);
        
        focusObjects.push(singleMesh);
      } else {
        // Regular mesh - use as is
        focusObjects.push(match.object as THREE.Mesh);
      }
    });
    
    return focusObjects;
  }

  /**
   * Add highlight overlays to selected meshes with different colors
   * Legacy method - maintains backward compatibility
   */
  addGuidHighlights(meshes: THREE.Mesh[]): void {
    // Store selected meshes for surrounding mode to work
    this.guidSelectedMeshes = meshes;
    
    // If we have GUID matches, use the enhanced method
    if (this.guidMatches.length > 0) {
      this.addGuidHighlightsFromMatches(this.guidMatches);
      return;
    }
    
    // Fallback for direct mesh highlighting (backward compatibility)
    const matches: GuidMatch[] = meshes.map(mesh => ({
      object: mesh,
      globalId: mesh.name || (mesh as any).userData?.name || 'unknown'
    }));
    this.addGuidHighlightsFromMatches(matches);
  }

  /**
   * Add highlights from GUID matches (supports InstancedMesh)
   */
  private addGuidHighlightsFromMatches(matches: GuidMatch[]): void {
    // Color palette for multiple objects
    const colorPalette = [
      { name: 'Green', color: 0x00ff00 },      // 1st object: Green
      { name: 'Purple', color: 0xbb00ff },     // 2nd object: Purple
      { name: 'Cyan', color: 0x00ffff },       // 3rd object: Cyan
      { name: 'Orange', color: 0xff8800 },     // 4th object: Orange
      { name: 'Yellow', color: 0xffff00 },     // 5th object: Yellow
      { name: 'Magenta', color: 0xff00ff },    // 6th object: Magenta
      { name: 'Lime', color: 0x88ff00 },       // 7th object: Lime
      { name: 'Pink', color: 0xff0088 }        // 8th object: Pink
    ];

    console.log(`[GuidController] Adding highlights to ${matches.length} object(s) with different colors`);

    matches.forEach((match, index) => {
      // Select color from palette
      const paletteIndex = index % colorPalette.length;
      const colorInfo = colorPalette[paletteIndex];

      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: colorInfo.color,
        transparent: true,
        opacity: 0.6,          // Bright and visible
        depthTest: false,      // Always render on top
        side: THREE.DoubleSide
      });

      let highlightMesh: THREE.Mesh;
      
      // Handle InstancedMesh differently
      if ((match.object as any).isInstancedMesh && match.instanceIndex !== undefined) {
        const instancedMesh = match.object as THREE.InstancedMesh;
        const instanceIndex = match.instanceIndex;
        
        console.log(`[GuidController] Creating highlight for InstancedMesh instance ${instanceIndex}`);
        
        // Clone geometry from InstancedMesh
        const geometry = instancedMesh.geometry.clone();
        
        // Get instance transformation matrix (relative to InstancedMesh)
        const instanceMatrix = new THREE.Matrix4();
        instancedMesh.getMatrixAt(instanceIndex, instanceMatrix);
        
        // Create highlight mesh
        highlightMesh = new THREE.Mesh(geometry, highlightMaterial);
        
        // Calculate world matrix: parent world matrix × instance matrix
        const worldMatrix = new THREE.Matrix4();
        worldMatrix.multiplyMatrices(instancedMesh.matrixWorld, instanceMatrix);
        
        // Apply world transformation to highlight mesh
        highlightMesh.applyMatrix4(worldMatrix);
        
        // Add to scene (not as child, since InstancedMesh can't have children)
        // Note: We've already applied the world transform, so add directly to scene
        this.scene.add(highlightMesh);
        
        console.log(`[GuidController] ✓ Added ${colorInfo.name} highlight for InstancedMesh instance ${instanceIndex}`);
        console.log(`  - Instance GlobalId: ${match.globalId}`);
        
        // Store highlight info
        this.highlightInfos.push({
          originalObject: instancedMesh,
          highlightMesh: highlightMesh,
          instanceIndex: instanceIndex
        });
      } else {
        // Regular Mesh - use overlay approach
        const mesh = match.object as THREE.Mesh;
        const geometry = mesh.geometry as THREE.BufferGeometry;
        if (!geometry) {
          console.warn(`[GuidController] Mesh ${index} has no geometry, skipping highlight`);
          return;
        }

        const overlayGeom = new THREE.BufferGeometry();
        overlayGeom.setAttribute('position', geometry.getAttribute('position'));
        
        const index_attr = geometry.getIndex();
        if (index_attr) {
          overlayGeom.setIndex(index_attr);
        }

        highlightMesh = new THREE.Mesh(overlayGeom, highlightMaterial);
        highlightMesh.renderOrder = 999;  // Render last
        highlightMesh.visible = true;
        
        // Add as child of original mesh
        mesh.add(highlightMesh);
        
        console.log(`[GuidController] ✓ Added ${colorInfo.name} highlight (${index + 1}/${matches.length}) to mesh: ${mesh.name}`);
        
        // Store highlight info
        this.highlightInfos.push({
          originalObject: mesh,
          highlightMesh: highlightMesh
        });
      }
      
      // Common properties for all highlights
      (highlightMesh as any).userData.isGuidHighlight = true;
      (highlightMesh as any).userData.highlightColor = colorInfo.name;
      this.guidHighlightOverlays.push(highlightMesh);
    });

    console.log(`[GuidController] Total highlights created: ${this.guidHighlightOverlays.length}`);
  }

  /**
   * Clear GUID highlights and restore surrounding objects
   */
  clearGuidHighlights(): void {
    // Restore surrounding objects first
    this.restoreSurroundingObjects();

    // Clear highlights - handle both regular overlays and InstancedMesh highlights
    this.guidHighlightOverlays.forEach(overlay => {
      // Remove from parent (for regular meshes) or scene (for InstancedMesh highlights)
      if (overlay.parent) {
        overlay.parent.remove(overlay);
      } else {
        this.scene.remove(overlay);
      }
      overlay.geometry.dispose();
      const mat = overlay.material as THREE.Material;
      if (mat) {
        mat.dispose();
      }
    });
    this.guidHighlightOverlays = [];
    this.guidSelectedMeshes = [];
    this.guidMatches = [];
    this.highlightInfos = [];
  }

  /**
   * Get currently selected meshes by GUID
   */
  getGuidSelectedMeshes(): THREE.Mesh[] {
    return this.guidSelectedMeshes;
  }

  /**
   * Get current surrounding mode
   */
  getSurroundingMode(): SurroundingMode {
    return this.surroundingMode;
  }

  /**
   * Set surrounding objects mode (hide or make transparent)
   * Supports both regular Meshes and InstancedMesh
   */
  setSurroundingMode(mode: SurroundingMode): void {
    console.log('[GuidController] setSurroundingMode called with mode:', mode);
    console.log('[GuidController] guidSelectedMeshes count:', this.guidSelectedMeshes.length);
    console.log('[GuidController] guidMatches count:', this.guidMatches.length);
    
    if (this.guidSelectedMeshes.length === 0 && this.guidMatches.length === 0) {
      console.warn('[GuidController] ⚠️ No objects selected. Cannot set surrounding mode.');
      return;
    }

    console.log(`[GuidController] 🔄 Setting surrounding mode: ${mode}`);

    // Restore previous state first
    this.restoreSurroundingObjects();

    this.surroundingMode = mode;

    if (mode === 'normal') {
      console.log('[GuidController] ✅ Restored to normal mode');
      return; // Already restored, nothing more to do
    }

    // Create set of selected objects (including InstancedMesh)
    const selectedObjects = new Set<THREE.Mesh | THREE.InstancedMesh>();
    this.guidMatches.forEach(match => {
      selectedObjects.add(match.object);
    });
    this.guidSelectedMeshes.forEach(mesh => {
      selectedObjects.add(mesh);
    });

    let affectedCount = 0;
    let skippedSelected = 0;
    let skippedOther = 0;

    // Traverse scene and apply mode to unselected objects
    this.scene.traverse((obj) => {
      const isMesh = (obj as any).isMesh;
      const isInstancedMesh = (obj as any).isInstancedMesh;
      
      if (!isMesh && !isInstancedMesh) return;
      
      const mesh = obj as THREE.Mesh | THREE.InstancedMesh;
      
      if (!(mesh as any).userData?.isUserModel) {
        skippedOther++;
        return;
      }
      if ((mesh as any).userData?.isMergedBatch) {
        skippedOther++;
        return;
      }
      if ((mesh as any).userData?.isEdgeOverlay) {
        skippedOther++;
        return;
      }
      if ((mesh as any).userData?.isGuidHighlight) {
        skippedOther++;
        return;
      }

      // Skip selected objects (for InstancedMesh, if any instance is selected, keep entire mesh visible)
      if (selectedObjects.has(mesh)) {
        skippedSelected++;
        return;
      }

      // Store original state
      if (!this.originalVisibility.has(mesh as THREE.Mesh)) {
        this.originalVisibility.set(mesh as THREE.Mesh, mesh.visible);
      }
      if (!this.originalMaterials.has(mesh as THREE.Mesh)) {
        this.originalMaterials.set(mesh as THREE.Mesh, mesh.material);
      }

      if (mode === 'hidden') {
        mesh.visible = false;
        affectedCount++;
      } else if (mode === 'transparent') {
        // Create transparent version of material
        const originalMat = mesh.material;
        if (Array.isArray(originalMat)) {
          const transparentMats = originalMat.map(mat => this.createTransparentMaterial(mat));
          mesh.material = transparentMats;
        } else {
          mesh.material = this.createTransparentMaterial(originalMat);
        }
        affectedCount++;
      }
    });

    console.log(`[GuidController] ✅ Surrounding mode applied: ${mode}`);
    console.log(`[GuidController] Affected objects: ${affectedCount}`);
    console.log(`[GuidController] Skipped (selected): ${skippedSelected}`);
    console.log(`[GuidController] Skipped (other): ${skippedOther}`);
  }

  /**
   * Create a transparent version of a material
   */
  private createTransparentMaterial(original: THREE.Material): THREE.Material {
    const transparent = original.clone();
    transparent.transparent = true;
    transparent.opacity = 0.15; // 15% opacity (85% transparent)
    transparent.depthWrite = false; // Prevent z-fighting
    return transparent;
  }

  /**
   * Restore surrounding objects to original state
   */
  private restoreSurroundingObjects(): void {
    // Restore visibility
    this.originalVisibility.forEach((originalVisible, mesh) => {
      mesh.visible = originalVisible;
    });

    // Restore materials
    this.originalMaterials.forEach((originalMat, mesh) => {
      // Dispose cloned transparent materials
      if (this.surroundingMode === 'transparent') {
        const currentMat = mesh.material;
        if (Array.isArray(currentMat)) {
          currentMat.forEach(mat => mat.dispose());
        } else {
          currentMat.dispose();
        }
      }
      mesh.material = originalMat;
    });

    this.originalVisibility.clear();
    this.originalMaterials.clear();
    this.surroundingMode = 'normal';
  }

  /**
   * Debug: List all GUIDs in loaded models (supports InstancedMesh)
   */
  listAllGUIDs(): void {
    console.log('=== All GUIDs in Scene ===');
    const guidMap = new Map<string, { name: string, type: string, isInstanced: boolean, instanceIndex?: number, userData: any }>();
    let instancedMeshCount = 0;
    let regularMeshCount = 0;
    
    this.scene.traverse(obj => {
      const isMesh = (obj as any).isMesh;
      const isInstancedMesh = (obj as any).isInstancedMesh;
      
      if (!isMesh && !isInstancedMesh) return;
      
      const mesh = obj as THREE.Mesh | THREE.InstancedMesh;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;
      
      const userData = (mesh as any).userData || {};
      
      if (isInstancedMesh) {
        instancedMeshCount++;
        // Check for globalIds array
        const globalIds = userData.globalIds;
        if (Array.isArray(globalIds) && globalIds.length > 0) {
          // GPU instancing - each instance has its own GlobalId
          globalIds.forEach((guid: string, instanceIndex: number) => {
            guidMap.set(String(guid), {
              name: mesh.name,
              type: mesh.type,
              isInstanced: true,
              instanceIndex: instanceIndex,
              userData: userData
            });
          });
        } else {
          // Fallback: single GUID for InstancedMesh
          const guids = [
            userData.name,
            mesh.name,
            userData.globalId,
            userData.GlobalId
          ].filter(Boolean);
          guids.forEach(guid => {
            guidMap.set(String(guid), {
              name: mesh.name,
              type: mesh.type,
              isInstanced: true,
              userData: userData
            });
          });
        }
      } else {
        regularMeshCount++;
        // Regular mesh
        const guids = [
          userData.name,
          mesh.name,
          userData.guid,
          userData.GlobalId,
          userData.expressID,
          userData.ifcGuid,
          userData.GUID,
          userData.globalId
        ].filter(Boolean);
        
        guids.forEach(guid => {
          guidMap.set(String(guid), {
            name: mesh.name,
            type: mesh.type,
            isInstanced: false,
            userData: userData
          });
        });
      }
    });
    
    console.log(`Total unique GUIDs: ${guidMap.size}`);
    console.log(`Regular meshes: ${regularMeshCount}, InstancedMesh nodes: ${instancedMeshCount}`);
    console.table(Array.from(guidMap.entries()).slice(0, 20).map(([guid, info]) => ({
      GUID: guid,
      Name: info.name,
      Type: info.type,
      Instanced: info.isInstanced ? `Yes (idx: ${info.instanceIndex ?? 'N/A'})` : 'No'
    })));
    
    console.log('Full GUID list:', Array.from(guidMap.keys()));
  }

  /**
   * Debug: Show what's actually in the model's userData (supports InstancedMesh)
   */
  inspectModelUserData(): void {
    console.log('=== Inspecting Model UserData ===');
    let meshCount = 0;
    let instancedMeshCount = 0;
    const samples: any[] = [];
    
    this.scene.traverse(obj => {
      const isMesh = (obj as any).isMesh;
      const isInstancedMesh = (obj as any).isInstancedMesh;
      
      if (!isMesh && !isInstancedMesh) return;
      
      const mesh = obj as THREE.Mesh | THREE.InstancedMesh;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;
      
      if (isInstancedMesh) {
        instancedMeshCount++;
      } else {
        meshCount++;
      }
      
      if (samples.length < 5) {
        const userData = (mesh as any).userData || {};
        samples.push({
          name: mesh.name,
          type: mesh.type,
          isInstancedMesh: isInstancedMesh,
          instanceCount: isInstancedMesh ? (mesh as THREE.InstancedMesh).count : undefined,
          hasGlobalIdsArray: Array.isArray(userData.globalIds),
          globalIdsLength: Array.isArray(userData.globalIds) ? userData.globalIds.length : 0,
          userData: userData,
          userDataKeys: Object.keys(userData)
        });
      }
    });
    
    console.log(`Total meshes found: ${meshCount} regular, ${instancedMeshCount} InstancedMesh`);
    console.log('Sample objects (first 5):');
    samples.forEach((sample, i) => {
      console.log(`\n--- Object ${i + 1}: ${sample.name} ---`);
      console.log('Type:', sample.type);
      console.log('Is InstancedMesh:', sample.isInstancedMesh);
      if (sample.isInstancedMesh) {
        console.log('Instance count:', sample.instanceCount);
        console.log('Has globalIds array:', sample.hasGlobalIdsArray);
        console.log('globalIds length:', sample.globalIdsLength);
        if (sample.hasGlobalIdsArray && sample.globalIdsLength > 0) {
          console.log('First 3 GlobalIds:', (sample.userData.globalIds as string[]).slice(0, 3));
        }
      }
      console.log('UserData keys:', sample.userDataKeys);
      console.log('Full userData:', sample.userData);
    });
    
    if (meshCount === 0 && instancedMeshCount === 0) {
      console.warn('⚠️ No meshes found! Check if batching is hiding them.');
      console.log('Try: Turn off batching first, then run this again');
    }
  }

  dispose(): void {
    this.clearGuidHighlights();
  }
}

