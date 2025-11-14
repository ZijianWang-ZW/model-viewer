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
export class GuidController {
  private scene: THREE.Scene;
  private camera: SimpleCamera;
  
  private guidSelectedMeshes: THREE.Mesh[] = [];
  private guidHighlightOverlays: THREE.Mesh[] = [];

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
   */
  findMeshesByGUIDs(guids: string[]): THREE.Mesh[] {
    const guidSet = new Set(guids.map(g => g.trim().toLowerCase()));
    const foundMeshes: THREE.Mesh[] = [];
    
    console.log('='.repeat(60));
    console.log('[GUID Search] 🔍 Starting search...');
    console.log('[GUID Search] Input GUIDs:', guids);
    console.log('[GUID Search] Normalized (lowercase):', Array.from(guidSet));
    
    let checkedCount = 0;
    let sampleGUIDs: string[] = [];
    
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;
      
      checkedCount++;
      const userData = (mesh as any).userData || {};
      
      if (sampleGUIDs.length < 3 && userData.name) {
        sampleGUIDs.push(userData.name);
      }
      
      const possibleGuids = [
        userData.name,
        mesh.name,
        userData.guid,
        userData.GlobalId,
        userData.expressID,
        userData.ifcGuid,
        userData.GUID
      ].filter(Boolean).map(g => String(g).toLowerCase());
      
      if (checkedCount === 1) {
        console.log('[GUID Search] 📋 First mesh example:');
        console.log('  - mesh.name:', mesh.name);
        console.log('  - userData.name:', userData.name);
        console.log('  - Checking against:', possibleGuids);
      }
      
      for (const guid of possibleGuids) {
        if (guidSet.has(guid)) {
          console.log('[GUID Search] ✅ FOUND MATCH!');
          console.log('  - Searched for:', Array.from(guidSet)[0]);
          console.log('  - Found:', guid);
          console.log('  - mesh.name:', mesh.name);
          console.log('  - userData:', userData);
          foundMeshes.push(mesh);
          break;
        }
      }
    });
    
    console.log(`[GUID Search] 📊 Results:`);
    console.log(`  - Meshes checked: ${checkedCount}`);
    console.log(`  - Matches found: ${foundMeshes.length}`);
    console.log(`  - Sample GUIDs in model:`, sampleGUIDs);
    
    if (foundMeshes.length === 0) {
      console.warn('[GUID Search] ⚠️ No matches found!');
      console.log('[GUID Search] 💡 Tip: Run debugViewer.listGUIDs() to see all available GUIDs');
    }
    
    console.log('='.repeat(60));
    
    return foundMeshes;
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
    const foundMeshes = this.findMeshesByGUIDs(guids);
    
    if (foundMeshes.length > 0) {
      this.clearGuidHighlights();
      this.addGuidHighlights(foundMeshes);
      this.focusOnObjects(foundMeshes, true);
      this.guidSelectedMeshes = foundMeshes;
    }
    
    return {
      found: foundMeshes,
      notFound: guids.length - foundMeshes.length
    };
  }

  /**
   * Add highlight overlays to selected meshes
   */
  addGuidHighlights(meshes: THREE.Mesh[]): void {
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      side: THREE.DoubleSide
    });

    meshes.forEach(mesh => {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry) return;

      const overlayGeom = new THREE.BufferGeometry();
      overlayGeom.setAttribute('position', geometry.getAttribute('position'));
      
      const index = geometry.getIndex();
      if (index) {
        overlayGeom.setIndex(index);
      }

      const overlay = new THREE.Mesh(overlayGeom, highlightMaterial.clone());
      (overlay as any).userData.isGuidHighlight = true;
      overlay.renderOrder = 999;
      
      mesh.add(overlay);
      this.guidHighlightOverlays.push(overlay);
    });
  }

  /**
   * Clear GUID highlights
   */
  clearGuidHighlights(): void {
    this.guidHighlightOverlays.forEach(overlay => {
      overlay.parent?.remove(overlay);
      overlay.geometry.dispose();
      (overlay.material as THREE.Material).dispose();
    });
    this.guidHighlightOverlays = [];
    this.guidSelectedMeshes = [];
  }

  /**
   * Get currently selected meshes by GUID
   */
  getGuidSelectedMeshes(): THREE.Mesh[] {
    return this.guidSelectedMeshes;
  }

  /**
   * Debug: List all GUIDs in loaded models
   */
  listAllGUIDs(): void {
    console.log('=== All GUIDs in Scene ===');
    const guidMap = new Map<string, { name: string, type: string, userData: any }>();
    
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;
      
      const userData = (mesh as any).userData || {};
      const guids = [
        userData.name,
        mesh.name,
        userData.guid,
        userData.GlobalId,
        userData.expressID,
        userData.ifcGuid,
        userData.GUID
      ].filter(Boolean);
      
      guids.forEach(guid => {
        guidMap.set(String(guid), {
          name: mesh.name,
          type: mesh.type,
          userData: userData
        });
      });
    });
    
    console.log(`Total unique GUIDs: ${guidMap.size}`);
    console.table(Array.from(guidMap.entries()).slice(0, 20).map(([guid, info]) => ({
      GUID: guid,
      Name: info.name,
      Type: info.type
    })));
    
    console.log('Full GUID list:', Array.from(guidMap.keys()));
  }

  /**
   * Debug: Show what's actually in the model's userData
   */
  inspectModelUserData(): void {
    console.log('=== Inspecting Model UserData ===');
    let meshCount = 0;
    const samples: any[] = [];
    
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;
      
      meshCount++;
      
      if (samples.length < 5) {
        samples.push({
          name: mesh.name,
          type: mesh.type,
          userData: mesh.userData,
          userDataKeys: Object.keys(mesh.userData || {})
        });
      }
    });
    
    console.log(`Total meshes found: ${meshCount}`);
    console.log('Sample meshes (first 5):');
    samples.forEach((sample, i) => {
      console.log(`\n--- Mesh ${i + 1}: ${sample.name} ---`);
      console.log('Type:', sample.type);
      console.log('UserData keys:', sample.userDataKeys);
      console.log('Full userData:', sample.userData);
    });
    
    if (meshCount === 0) {
      console.warn('⚠️ No meshes found! Check if batching is hiding them.');
      console.log('Try: Turn off batching first, then run this again');
    }
  }

  dispose(): void {
    this.clearGuidHighlights();
  }
}

