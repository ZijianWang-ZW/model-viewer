import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { ClipperController } from '../clipping';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { batchMeshes, batchMeshesFromList, unbatch, type BatchingResult } from '../batching';
import { AdaptiveResolutionController } from '../adaptiveRes';
import { InteractionCullingController } from '../culling';
import { SelectionController } from '../selection';
import { HighlightController } from '../highlight';
import { ModelManager, type DisciplineType } from '../modelManager';

export interface ViewerStats {
  originalMeshes: number;
  batches: number;
  uniqueMaterials: number;
  unbatchedOriginals: number;
}

export interface BatchInfoItem {
  originalCount: number;
}

export class Viewer {
  private container: HTMLElement;

  // ThatOpen Components world
  private components: OBC.Components;
  private world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
  private loader = new GLTFLoader();

  // Controllers
  private selection: SelectionController;
  private adaptiveRes: AdaptiveResolutionController;
  private cullingCtrl: InteractionCullingController;
  private highlightCtrl: HighlightController;

  // Edges overlay state
  private edgesEnabled = false;
  private edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, depthTest: true });
  private static readonly EDGE_THRESHOLD_ANGLE_DETAILED = 1;
  private static readonly EDGE_THRESHOLD_ANGLE_MERGED = 25;
  private edgesCache = new Map<string, THREE.EdgesGeometry>();
  private firstEdgesBuildMs: number | null = null;

  // Batching
  private batchingEnabled = true;
  private currentBatching: BatchingResult | null = null;
  private maxVerticesPerBatch = 20000;

  // RAF loop
  private rafId: number | null = null;

  // Clipping
  private clipperCtrl!: ClipperController;

  // Model management
  private modelManager = new ModelManager();

  constructor(container: HTMLElement) {
    this.container = container;

    this.components = new OBC.Components();
    const worlds = this.components.get(OBC.Worlds);
    this.world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    this.world.scene = new OBC.SimpleScene(this.components);
    this.world.renderer = new OBC.SimpleRenderer(this.components, this.container);
    this.world.camera = new OBC.SimpleCamera(this.components);

    this.components.init();
    this.world.scene.setup();
    // Default scene background
    // Ensure local clipping is enabled for materials
    this.renderer.localClippingEnabled = true;

    // Enable raycasting for this world so Clipper can pick intersections
    const raycasters = this.components.get(OBC.Raycasters);
    raycasters.get(this.world);
    // Track edges toggle state on scene for other controllers
    (this.world.scene.three as any).userData = (this.world.scene.three as any).userData || {};
    (this.world.scene.three as any).userData.edgesEnabled = this.edgesEnabled;
    this.world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    // Remove camera smoothing for snappier feel
    const ctrls: any = this.world.camera.controls as any;
    if (ctrls) {
      if ('smoothTime' in ctrls) ctrls.smoothTime = 0;
      if ('draggingSmoothTime' in ctrls) ctrls.draggingSmoothTime = 0.05; // default
      if ('dragInertia' in ctrls) ctrls.dragInertia = 0;
    }

    // Controllers
    this.adaptiveRes = new AdaptiveResolutionController(this.world.renderer);
    this.cullingCtrl = new InteractionCullingController(this.world.camera, this.world.renderer);
    this.selection = new SelectionController({ world: { camera: this.world.camera, renderer: this.world.renderer }, scene: this.world.scene.three as unknown as THREE.Scene, selectionColor: 0x00D5B9 });
    this.selection.attach();
    this.highlightCtrl = new HighlightController(
      this.scene,
      () => this.currentBatching,
      () => this.batchingEnabled
    );

    // Global interactions for adaptive resolution
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });

    // Clipper controller
    this.clipperCtrl = new ClipperController(this.components, this.world);

    // Start incremental update loop
    this.rafId = requestAnimationFrame(this.animationLoop);
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);

    this.selection.detach();
    this.adaptiveRes.dispose();
    this.cullingCtrl.dispose();
    this.highlightCtrl.dispose();
    // Dispose clipping planes and related resources
    if (this.clipperCtrl) this.clipperCtrl.dispose();
    this.clearPreviousModel();
  }

  // Public API
  async loadGLBFromFile(file: File, discipline?: DisciplineType) {
    this.clearPreviousModel();
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      (root as any).userData.isUserModel = true;
      // Mark just the actual meshes inside (avoid polluting non-user nodes later)
      const toMark: THREE.Mesh[] = [];
      root.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) toMark.push(m); });
      for (const m of toMark) {
        (m as any).userData = (m as any).userData || {};
        (m as any).userData.isUserModel = true;
      }
      this.scene.add(root);

      if (this.batchingEnabled) {
        const allow32 = this.supportsUint32Indices();
        this.currentBatching = batchMeshes(root, {
          allow32Bit: allow32,
          maxVerticesPerBatch: this.maxVerticesPerBatch
        }) || null;
      }
      this.cullingCtrl.register(root);

      // Reset adaptive/culling defaults as in original behavior
      this.adaptiveRes.resetToDefaults();
      this.cullingCtrl.setThreshold(50);

      // Scale clip plane size to model bounds for visibility
      this.clipperCtrl.scaleSizeToUserModels(this.scene);

      if (this.edgesEnabled) this.addEdgesForCurrentModel();

      // Disable highlighting by default for new model
      this.highlightCtrl.highlightTextMeshes(false, '');

      // Register with model manager
      if (discipline) {
        const modelId = this.modelManager.addModel(file.name, discipline, root, this.currentBatching);
        (root as any).userData.modelId = modelId;
      }

      // Notify that a new model was loaded
      window.dispatchEvent(new CustomEvent('viewer:modelLoaded', { detail: { discipline } }));

      this.fitCameraToAllModels();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Load additional model without clearing existing ones
   */
  async loadAdditionalModel(file: File, discipline: DisciplineType): Promise<string> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      (root as any).userData.isUserModel = true;
      
      // Mark meshes
      const toMark: THREE.Mesh[] = [];
      root.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) toMark.push(m); });
      for (const m of toMark) {
        (m as any).userData = (m as any).userData || {};
        (m as any).userData.isUserModel = true;
      }
      
      this.scene.add(root);

      // Per-model batching
      let modelBatching: BatchingResult | null = null;
      if (this.batchingEnabled) {
        const allow32 = this.supportsUint32Indices();
        modelBatching = batchMeshes(root, {
          allow32Bit: allow32,
          maxVerticesPerBatch: this.maxVerticesPerBatch
        }) || null;
      }
      
      this.cullingCtrl.register(root);

      // Scale clip plane to accommodate all models
      this.clipperCtrl.scaleSizeToUserModels(this.scene);

      if (this.edgesEnabled) this.addEdgesForCurrentModel();

      // Register with model manager
      const modelId = this.modelManager.addModel(file.name, discipline, root, modelBatching);
      (root as any).userData.modelId = modelId;

      // Notify that a new model was loaded
      window.dispatchEvent(new CustomEvent('viewer:modelLoaded', { detail: { discipline, modelId } }));

      this.fitCameraToAllModels();
      
      return modelId;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  getStats(): ViewerStats {
    let originalMeshes = 0;
    let unbatchedOriginals = 0;
    const materialSet = new Set<string>();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const ud = (m as any).userData || {};
      // Count originals: either explicitly marked as original of a batch, or user meshes that are not merged/overlay
      if (ud.isBatchedOriginal) originalMeshes++;
      else if (ud.isUserModel && !ud.isMergedBatch && !ud.isEdgeOverlay) {
        originalMeshes++;
        unbatchedOriginals++;
      }
      // Unique materials: only count materials of user-model renderables (merged or originals), skip overlays
      if (!ud.isUserModel || ud.isEdgeOverlay) return;
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      if (Array.isArray(mat)) { for (const mm of mat) materialSet.add(mm.uuid); }
      else materialSet.add(mat.uuid);
    });
    const batches = this.currentBatching ? this.currentBatching.mergedMeshes.length : 0;
    return { originalMeshes, batches, uniqueMaterials: materialSet.size, unbatchedOriginals };
  }

  // Precomputed batch breakdown for fast UI expansion
  getBatchDetails(): BatchInfoItem[] {
    if (!this.currentBatching) return [];
    // Fast path: mergedRanges exists per merged mesh; count lengths directly
    const items: BatchInfoItem[] = [];
    for (const mm of this.currentBatching.mergedMeshes) {
      const ranges = (mm as any).userData?.mergedRanges as { start: number; count: number; original: THREE.Mesh }[] | undefined;
      items.push({ originalCount: ranges ? ranges.length : 0 });
    }
    return items;
  }

  // findMergedContainingOriginal retained in case of future needs, but not used in fast path

  setEdgesEnabled(enabled: boolean) {
    this.edgesEnabled = enabled;
    // Publish state for other controllers
    (this.scene as any).userData = (this.scene as any).userData || {};
    (this.scene as any).userData.edgesEnabled = enabled;
    // Notify listeners (e.g., selection) to refresh their visuals
    window.dispatchEvent(new CustomEvent('viewer:edgesToggled', { detail: { enabled } }));
    if (enabled) {
      // Measure first build only
      const needMeasure = this.firstEdgesBuildMs === null;
      let t0 = 0;
      if (needMeasure) t0 = performance.now();
      this.addEdgesForCurrentModel();
      this.setEdgeOverlaysVisible(true);
      if (needMeasure) {
        this.firstEdgesBuildMs = Math.max(0, performance.now() - t0);
        this.emitEdgesBuildTime();
      }
    } else {
      // Hide overlays but keep them and keep geometry cache for instant re-enable
      this.setEdgeOverlaysVisible(false);
    }
  }

  isEdgesEnabled() { return this.edgesEnabled; }

  hasBuiltEdges(): boolean { return this.firstEdgesBuildMs !== null; }

  setBatchingEnabled(enabled: boolean) {
    this.batchingEnabled = enabled;

    // If text highlighting is active, temporarily disable it during batching changes
    const wasTextActive = this.highlightCtrl.isTextHighlightActive();
    const searchText = this.highlightCtrl.getCurrentSearchText();

    if (this.currentBatching) {
      unbatch(this.currentBatching);
      this.currentBatching = null;
    }
    this.selection.clear();

    if (enabled) {
      const allow32 = this.supportsUint32Indices();
      const candidates: THREE.Mesh[] = [];
      this.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m as any).userData?.isUserModel && !(m as any).userData.isMergedBatch) {
          candidates.push(m);
        }
      });
      const result = batchMeshesFromList(candidates, this.scene, {
        allow32Bit: allow32,
        maxVerticesPerBatch: this.maxVerticesPerBatch
      });
      if (result) {
        this.currentBatching = result;
      }
    }

    if (this.edgesEnabled) {
      this.removeAllEdgeOverlays();
      this.addEdgesForCurrentModel();
    }

    // Re-register culling reflecting visibility/merged state
    this.cullingCtrl.clear();
    const userRoot = new THREE.Group();
    this.scene.traverse(o => { if ((o as any).userData?.isUserModel) userRoot.add(o); });
    this.cullingCtrl.register(userRoot);

    // Re-apply text highlighting if it was active
    if (wasTextActive && searchText) {
      this.highlightCtrl.highlightTextMeshes(true, searchText);
    }
  }

  isBatchingEnabled() { return this.batchingEnabled; }

  setCullingEnabled(enabled: boolean) {
    (this.cullingCtrl as any).enabled = enabled;
    if (!enabled) this.cullingCtrl.onInteractionEndVisibilityRestore();
  }

  isCullingEnabled() { return (this.cullingCtrl as any).enabled === true; }

  setCullingThreshold(px: number) { this.cullingCtrl.setThreshold(px); }

  setAdaptiveEnabled(enabled: boolean) { this.adaptiveRes.setEnabled(enabled); }

  isAdaptiveEnabled() { return this.adaptiveRes.enabled; }

  setDraggingSmoothTime(value: number) {
    const ctrls: any = this.world.camera.controls as any;
    if (!ctrls || typeof value !== 'number') return;
    if (value < 0 || value > 0.5) return; // ignore invalid
    if ('draggingSmoothTime' in ctrls) ctrls.draggingSmoothTime = value;
  }

  setZoomSpeed(multiplier: number) {
    const ctrls: any = this.world.camera.controls as any;
    if (!ctrls || typeof multiplier !== 'number') return;
    const m = Math.max(0.1, multiplier);
    // Support different control implementations
    if ('dollySpeed' in ctrls) ctrls.dollySpeed = m; // e.g., CameraControls
    if ('zoomSpeed' in ctrls) ctrls.zoomSpeed = m;   // e.g., OrbitControls
    if ('wheelDelta' in ctrls && typeof ctrls.wheelDelta === 'number') ctrls.wheelDelta = m;
  }

  // Internals
  private get scene(): THREE.Scene { return this.world.scene!.three as unknown as THREE.Scene; }
  private get renderer(): THREE.WebGLRenderer { return this.world.renderer!.three as unknown as THREE.WebGLRenderer; }
  private get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera { return this.world.camera!.three as THREE.PerspectiveCamera | THREE.OrthographicCamera; }

  private animationLoop = () => {
    this.cullingCtrl.update();
    // Ensure renderer updates each frame; needed for postprocessing & overlays
    (this.world.renderer as any).update?.();
    this.rafId = requestAnimationFrame(this.animationLoop);
  };

  private onResize = () => { this.world.renderer?.resize(); };
  private onPointerDown = () => { this.adaptiveRes.onInteractionStart(); };
  private onPointerUp = () => { this.adaptiveRes.onInteractionEnd(); };
  private onWheel = () => { this.adaptiveRes.onInteractionStart(); };

  private supportsUint32Indices(): boolean {
    const gl = this.renderer.getContext() as WebGLRenderingContext | WebGL2RenderingContext;
    const isWebGL2 = (gl as WebGL2RenderingContext).drawBuffers !== undefined || (gl as any).VERSION === 2;
    if (isWebGL2) return true;
    return !!(gl as WebGLRenderingContext).getExtension && !!(gl as WebGLRenderingContext).getExtension('OES_element_index_uint');
  }

  private clearPreviousModel() {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj: THREE.Object3D) => { if ((obj as any).userData?.isUserModel) toRemove.push(obj); });
    toRemove.forEach(obj => {
      obj.parent?.remove(obj);
      obj.traverse((child: THREE.Object3D) => {
        const anyChild = child as any;
        if (anyChild.geometry?.dispose) anyChild.geometry.dispose();
        const mat = anyChild.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
        else mat?.dispose?.();
      });
    });
    if (this.currentBatching) {
      unbatch(this.currentBatching);
      this.currentBatching = null;
    }
    this.removeAllEdgeOverlays();
    this.clearEdgesCache();
    // Reset first-edges timer so the next model's first edge build emits timing
    this.firstEdgesBuildMs = null;
    this.selection.clear();
    this.cullingCtrl.clear();
  }

  private fitCameraToObject(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let distance = 10;
    if ((this.camera as any).isPerspectiveCamera) {
      const persp = this.camera as THREE.PerspectiveCamera;
      const fov = persp.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.tan(fov / 2)) * 0.5;
    } else {
      const ortho = this.camera as THREE.OrthographicCamera;
      const span = maxDim * 1.5;
      ortho.top = span / 2; ortho.bottom = -span / 2; ortho.left = -span / 2; ortho.right = span / 2;
      ortho.updateProjectionMatrix();
      distance = maxDim * 2;
    }

    const dir = new THREE.Vector3(1, 1, 1).normalize();
    const eye = center.clone().add(dir.multiplyScalar(distance));
    this.world.camera.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z);
  }

  /**
   * Fit camera to all loaded models
   */
  private fitCameraToAllModels() {
    const box = new THREE.Box3();
    let hasAny = false;
    
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh && (m as any).userData?.isUserModel && !(m as any).userData?.isEdgeOverlay) {
        box.expandByObject(m);
        hasAny = true;
      }
    });

    if (!hasAny) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let distance = 10;
    if ((this.camera as any).isPerspectiveCamera) {
      const persp = this.camera as THREE.PerspectiveCamera;
      const fov = persp.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.tan(fov / 2)) * 0.5;
    } else {
      const ortho = this.camera as THREE.OrthographicCamera;
      const span = maxDim * 1.5;
      ortho.top = span / 2; ortho.bottom = -span / 2; ortho.left = -span / 2; ortho.right = span / 2;
      ortho.updateProjectionMatrix();
      distance = maxDim * 2;
    }

    const dir = new THREE.Vector3(1, 1, 1).normalize();
    const eye = center.clone().add(dir.multiplyScalar(distance));
    this.world.camera.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z);
  }

  private getOrCreateEdgesGeometry(geometry: THREE.BufferGeometry, threshold: number) {
    const key = geometry.uuid + ':' + threshold;
    let geom = this.edgesCache.get(key);
    if (!geom) {
      geom = new THREE.EdgesGeometry(geometry, threshold);
      this.edgesCache.set(key, geom);
    }
    return geom;
  }

  private clearEdgesCache() {
    this.edgesCache.forEach(g => g.dispose());
    this.edgesCache.clear();
  }

  private addEdgesForCurrentModel() {
    const mergedMeshes: THREE.Mesh[] = [];
    const smallMeshes: THREE.Mesh[] = [];
    this.scene.traverse(obj => {
      const m = obj as THREE.Mesh;
      if (!(m as any).isMesh) return;
      if (!(m as any).userData?.isUserModel) return;
      if ((m as any).userData.isMergedBatch) mergedMeshes.push(m);
      else smallMeshes.push(m);
    });

    for (const mesh of smallMeshes) {
      if (!mesh.geometry) continue;
      const hasEdges = mesh.children.some(c => (c as any).userData?.isEdgeOverlay);
      if (hasEdges) continue;
      const egeom = this.getOrCreateEdgesGeometry(mesh.geometry as THREE.BufferGeometry, Viewer.EDGE_THRESHOLD_ANGLE_DETAILED);
      const lines = new THREE.LineSegments(egeom, this.edgesMaterial.clone());
      (lines as any).userData.isUserModel = true;
      (lines as any).userData.isEdgeOverlay = true;
      (lines as any).renderOrder = 1;
      mesh.add(lines);
    }

    for (const mesh of mergedMeshes) {
      const hasMerged = mesh.children.some(c => (c as any).userData?.isMergedEdgeOverlay);
      if (hasMerged) continue;
      const geom = mesh.geometry as THREE.BufferGeometry;
      if (!geom) continue;
      const egeom = this.getOrCreateEdgesGeometry(geom, Viewer.EDGE_THRESHOLD_ANGLE_MERGED);
      const lines = new THREE.LineSegments(egeom, this.edgesMaterial.clone());
      (lines as any).userData.isUserModel = true;
      (lines as any).userData.isEdgeOverlay = true;
      (lines as any).userData.isMergedEdgeOverlay = true;
      (lines as any).renderOrder = 1;
      mesh.add(lines);
    }
  }

  private removeAllEdgeOverlays() {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse(o => { if ((o as any).userData?.isEdgeOverlay) toRemove.push(o); });
    toRemove.forEach(e => {
      const lines = e as THREE.LineSegments;
      const mat = lines.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
      else mat?.dispose?.();
      e.parent?.remove(e);
    });
  }

  private setEdgeOverlaysVisible(visible: boolean) {
    this.scene.traverse(o => {
      if ((o as any).userData?.isEdgeOverlay) {
        (o as any).visible = visible;
      }
    });
  }

  private emitEdgesBuildTime() {
    if (this.firstEdgesBuildMs == null) return;
    const ev = new CustomEvent('viewer:edgesBuilt', { detail: { ms: this.firstEdgesBuildMs } });
    window.dispatchEvent(ev);
  }

  // Clipping API
  async createClipPlane(): Promise<boolean> {
    // Create a plane immediately at model center facing up (no picking required)
    try {
      // Clear existing to ensure one visible plane
      this.clipperCtrl.deleteAll();
      // Compute center from current user model(s)
      const box = new THREE.Box3();
      let hasAny = false;
      this.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m as any).userData?.isUserModel) {
          box.expandByObject(m);
          hasAny = true;
        }
      });
      const center = hasAny ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
      const normal = new THREE.Vector3(0, 1, 0);
      this.clipperCtrl.createAt(normal, center);
      return true;
    } catch {
      return false;
    }
  }

  createClipPlaneAxis(axis: 'x' | 'y' | 'z'): boolean {
    try {
      this.clipperCtrl.deleteAll();
      const box = new THREE.Box3();
      let hasAny = false;
      this.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m as any).userData?.isUserModel) {
          box.expandByObject(m);
          hasAny = true;
        }
      });
      const center = hasAny ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
      const normal = axis === 'x' ? new THREE.Vector3(1, 0, 0)
        : axis === 'y' ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
      this.clipperCtrl.createAt(normal, center);
      return true;
    } catch {
      return false;
    }
  }

  async deleteClipPlane(_id?: string): Promise<void> { this.clipperCtrl.deleteAll(); }

  deleteAllClipPlanes(): void { this.clipperCtrl.deleteAll(); }

  createClipPlaneAt(normal: THREE.Vector3, point: THREE.Vector3): string { return this.clipperCtrl.createAt(normal, point); }

  setClipVisible(visible: boolean): void { this.clipperCtrl.setVisible(visible); }

  isClipVisible(): boolean { return this.clipperCtrl.isVisible(); }

  // Optional viewer-level subscriptions for Clipper events
  onClipAfterCreate(_handler: (plane: OBC.SimplePlane) => void) { }
  onClipAfterDelete(_handler: (plane: OBC.SimplePlane) => void) { }
  onClipAfterCancel(_handler: () => void) { }
  onClipAfterDrag(_handler: () => void) { }

  setSelectionEnabled(state: boolean) { this.selection.setEnabled(state); }

  // Highlight controller public API
  highlightTextMeshes(enable: boolean, searchText: string) {
    this.highlightCtrl.highlightTextMeshes(enable, searchText);
  }

  isTextHighlightActive(): boolean {
    return this.highlightCtrl.isTextHighlightActive();
  }

  getHighlightController(): HighlightController {
    return this.highlightCtrl;
  }

  getHighlightedCount(): number {
    return this.highlightCtrl.getHighlightedCount();
  }

  setMaxVerticesPerBatch(value: number) {
    this.maxVerticesPerBatch = Math.max(100, Math.min(100000, value)); // 100 to 100,000 vertices
  }

  getMaxVerticesPerBatch(): number {
    return this.maxVerticesPerBatch;
  }

  rebuildBatching() {
    if (!this.batchingEnabled || !this.currentBatching) return;

    // Store current batching state
    const wasEnabled = this.batchingEnabled;

    // Clear current batching
    if (this.currentBatching) {
      unbatch(this.currentBatching);
      this.currentBatching = null;
    }

    // Rebuild with new settings
    if (wasEnabled) {
      const allow32 = this.supportsUint32Indices();
      const candidates: THREE.Mesh[] = [];
      this.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m as any).userData?.isUserModel && !(m as any).userData.isMergedBatch && !(m as any).userData.isEdgeOverlay) {
          candidates.push(m);
        }
      });

      const result = batchMeshesFromList(candidates, this.scene, {
        allow32Bit: allow32,
        maxVerticesPerBatch: this.maxVerticesPerBatch
      });

      if (result) {
        this.currentBatching = result;
      }

      // Rebuild edges if enabled
      if (this.edgesEnabled) {
        this.removeAllEdgeOverlays();
        this.addEdgesForCurrentModel();
      }

      // Refresh highlighting if active
      if (this.highlightCtrl.isTextHighlightActive()) {
        this.highlightCtrl.refreshHighlighting();
      }
    }
  }

  // Model management API
  getModelManager(): ModelManager {
    return this.modelManager;
  }

  setModelVisibility(modelId: string, visible: boolean): void {
    this.modelManager.setModelVisibility(modelId, visible);
  }


  setAllModelsVisibility(visible: boolean): void {
    this.modelManager.setAllModelsVisibility(visible);
  }

  removeModel(modelId: string): void {
    const model = this.modelManager.removeModel(modelId);
    if (model) {
      // Remove from scene
      this.scene.remove(model.root);
      
      // Dispose geometry and materials
      model.root.traverse((child: THREE.Object3D) => {
        const anyChild = child as any;
        if (anyChild.geometry?.dispose) anyChild.geometry.dispose();
        const mat = anyChild.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
        else mat?.dispose?.();
      });

      // Unbatch if needed
      if (model.batching) {
        unbatch(model.batching);
      }

      // Notify
      window.dispatchEvent(new CustomEvent('viewer:modelRemoved', { detail: { modelId } }));
    }
  }
}



