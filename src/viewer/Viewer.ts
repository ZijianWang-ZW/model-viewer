import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { ClipperController } from '../clipping';
import { batchMeshesFromList, unbatch, type BatchingResult } from '../batching';
import { AdaptiveResolutionController } from '../adaptiveRes';
import { InteractionCullingController } from '../culling';
import { SelectionController } from '../selection';
import { HighlightController } from '../highlight';
import { ModelManager, type DisciplineType } from '../modelManager';
import { GuidController } from './GuidController';
import { EdgeController } from './EdgeController';
import { ModelLoaderController } from './ModelLoaderController';

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

  // Controllers
  private selection: SelectionController;
  private adaptiveRes: AdaptiveResolutionController;
  private cullingCtrl: InteractionCullingController;
  private highlightCtrl: HighlightController;
  private clipperCtrl!: ClipperController;
  private guidCtrl: GuidController;
  private edgeCtrl: EdgeController;
  private modelLoader: ModelLoaderController;

  // Batching
  private batchingEnabled = false; // Default OFF for GUID search
  private currentBatching: BatchingResult | null = null;
  private maxVerticesPerBatch = 20000;

  // RAF loop
  private rafId: number | null = null;

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
    this.renderer.localClippingEnabled = true;

    const raycasters = this.components.get(OBC.Raycasters);
    raycasters.get(this.world);
    
    this.world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    const ctrls: any = this.world.camera.controls as any;
    if (ctrls) {
      if ('smoothTime' in ctrls) ctrls.smoothTime = 0;
      if ('draggingSmoothTime' in ctrls) ctrls.draggingSmoothTime = 0.05;
      if ('dragInertia' in ctrls) ctrls.dragInertia = 0;
    }

    // Initialize controllers
    this.adaptiveRes = new AdaptiveResolutionController(this.world.renderer);
    this.cullingCtrl = new InteractionCullingController(this.world.camera, this.world.renderer);
    this.selection = new SelectionController({
      world: { camera: this.world.camera, renderer: this.world.renderer },
      scene: this.world.scene.three as unknown as THREE.Scene,
      selectionColor: 0x00D5B9
    });
    this.selection.attach();
    this.highlightCtrl = new HighlightController(
      this.scene,
      () => this.currentBatching,
      () => this.batchingEnabled
    );
    this.guidCtrl = new GuidController(this.scene, this.world.camera);
    this.edgeCtrl = new EdgeController(this.scene);
    this.modelLoader = new ModelLoaderController(this.scene, this.world.camera, this.modelManager);

    // Global interactions
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });

    this.clipperCtrl = new ClipperController(this.components, this.world);

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
    this.guidCtrl.dispose();
    this.edgeCtrl.dispose();
    if (this.clipperCtrl) this.clipperCtrl.dispose();
    this.clearPreviousModel();
  }

  // Public API - Model Loading
  async loadGLBFromFile(file: File, discipline?: DisciplineType) {
    this.clearPreviousModel();
    
    const { root, batching } = await this.modelLoader.loadGLBFile(
      file,
      discipline,
      {
        batchingEnabled: this.batchingEnabled,
        allow32Bit: this.supportsUint32Indices(),
        maxVerticesPerBatch: this.maxVerticesPerBatch
      },
      () => {
        if (this.edgeCtrl.isEnabled()) {
          this.edgeCtrl.addEdgesForCurrentModel();
        }
      }
    );

    this.currentBatching = batching;
    this.cullingCtrl.register(root);
    this.adaptiveRes.resetToDefaults();
    this.cullingCtrl.setThreshold(50);
    this.clipperCtrl.scaleSizeToUserModels(this.scene);
    this.highlightCtrl.highlightTextMeshes(false, '');
    this.modelLoader.fitCameraToAllModels(this.camera);
  }

  async loadAdditionalModel(file: File, discipline: DisciplineType): Promise<string> {
    const { modelId, root, batching } = await this.modelLoader.loadAdditionalModel(
      file,
      discipline,
      {
        batchingEnabled: this.batchingEnabled,
        allow32Bit: this.supportsUint32Indices(),
        maxVerticesPerBatch: this.maxVerticesPerBatch
      },
      () => {
        if (this.edgeCtrl.isEnabled()) {
          this.edgeCtrl.addEdgesForCurrentModel();
        }
      }
    );

    this.cullingCtrl.register(root);
    this.clipperCtrl.scaleSizeToUserModels(this.scene);
    this.modelLoader.fitCameraToAllModels(this.camera);
    
    return modelId;
  }

  // Public API - Stats
  getStats(): ViewerStats {
    let originalMeshes = 0;
    let unbatchedOriginals = 0;
    const materialSet = new Set<string>();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const ud = (m as any).userData || {};
      if (ud.isBatchedOriginal) originalMeshes++;
      else if (ud.isUserModel && !ud.isMergedBatch && !ud.isEdgeOverlay) {
        originalMeshes++;
        unbatchedOriginals++;
      }
      if (!ud.isUserModel || ud.isEdgeOverlay) return;
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      if (Array.isArray(mat)) {
        for (const mm of mat) materialSet.add(mm.uuid);
      } else materialSet.add(mat.uuid);
    });
    const batches = this.currentBatching ? this.currentBatching.mergedMeshes.length : 0;
    return { originalMeshes, batches, uniqueMaterials: materialSet.size, unbatchedOriginals };
  }

  getBatchDetails(): BatchInfoItem[] {
    if (!this.currentBatching) return [];
    const items: BatchInfoItem[] = [];
    for (const mm of this.currentBatching.mergedMeshes) {
      const ranges = (mm as any).userData?.mergedRanges as { start: number; count: number; original: THREE.Mesh }[] | undefined;
      items.push({ originalCount: ranges ? ranges.length : 0 });
    }
    return items;
  }

  // Public API - Edges
  setEdgesEnabled(enabled: boolean) {
    this.edgeCtrl.setEnabled(enabled);
  }

  isEdgesEnabled() {
    return this.edgeCtrl.isEnabled();
  }

  hasBuiltEdges(): boolean {
    return this.edgeCtrl.hasBuiltEdges();
  }

  // Public API - Batching
  setBatchingEnabled(enabled: boolean) {
    this.batchingEnabled = enabled;

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

    if (this.edgeCtrl.isEnabled()) {
      this.edgeCtrl.removeAllEdgeOverlays();
      this.edgeCtrl.addEdgesForCurrentModel();
    }

    this.cullingCtrl.clear();
    const userRoot = new THREE.Group();
    this.scene.traverse(o => {
      if ((o as any).userData?.isUserModel) userRoot.add(o);
    });
    this.cullingCtrl.register(userRoot);

    if (wasTextActive && searchText) {
      this.highlightCtrl.highlightTextMeshes(true, searchText);
    }
  }

  isBatchingEnabled() {
    return this.batchingEnabled;
  }

  setMaxVerticesPerBatch(value: number) {
    this.maxVerticesPerBatch = Math.max(100, Math.min(100000, value));
  }

  getMaxVerticesPerBatch(): number {
    return this.maxVerticesPerBatch;
  }

  rebuildBatching() {
    if (!this.batchingEnabled || !this.currentBatching) return;

    const wasEnabled = this.batchingEnabled;

    if (this.currentBatching) {
      unbatch(this.currentBatching);
      this.currentBatching = null;
    }

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

      if (this.edgeCtrl.isEnabled()) {
        this.edgeCtrl.removeAllEdgeOverlays();
        this.edgeCtrl.addEdgesForCurrentModel();
      }

      if (this.highlightCtrl.isTextHighlightActive()) {
        this.highlightCtrl.refreshHighlighting();
      }
    }
  }

  // Public API - Culling
  setCullingEnabled(enabled: boolean) {
    (this.cullingCtrl as any).enabled = enabled;
    if (!enabled) this.cullingCtrl.onInteractionEndVisibilityRestore();
  }

  isCullingEnabled() {
    return (this.cullingCtrl as any).enabled === true;
  }

  setCullingThreshold(px: number) {
    this.cullingCtrl.setThreshold(px);
  }

  // Public API - Adaptive Resolution
  setAdaptiveEnabled(enabled: boolean) {
    this.adaptiveRes.setEnabled(enabled);
  }

  isAdaptiveEnabled() {
    return this.adaptiveRes.enabled;
  }

  // Public API - Camera Controls
  setDraggingSmoothTime(value: number) {
    const ctrls: any = this.world.camera.controls as any;
    if (!ctrls || typeof value !== 'number') return;
    if (value < 0 || value > 0.5) return;
    if ('draggingSmoothTime' in ctrls) ctrls.draggingSmoothTime = value;
  }

  setZoomSpeed(multiplier: number) {
    const ctrls: any = this.world.camera.controls as any;
    if (!ctrls || typeof multiplier !== 'number') return;
    const m = Math.max(0.1, multiplier);
    if ('dollySpeed' in ctrls) ctrls.dollySpeed = m;
    if ('zoomSpeed' in ctrls) ctrls.zoomSpeed = m;
    if ('wheelDelta' in ctrls && typeof ctrls.wheelDelta === 'number') ctrls.wheelDelta = m;
  }

  // Public API - Clipping
  async createClipPlane(): Promise<boolean> {
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

  async deleteClipPlane(_id?: string): Promise<void> {
    this.clipperCtrl.deleteAll();
  }

  deleteAllClipPlanes(): void {
    this.clipperCtrl.deleteAll();
  }

  createClipPlaneAt(normal: THREE.Vector3, point: THREE.Vector3): string {
    return this.clipperCtrl.createAt(normal, point);
  }

  setClipVisible(visible: boolean): void {
    this.clipperCtrl.setVisible(visible);
  }

  isClipVisible(): boolean {
    return this.clipperCtrl.isVisible();
  }

  // Public API - Selection
  setSelectionEnabled(state: boolean) {
    this.selection.setEnabled(state);
  }

  // Public API - Highlighting
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

  // Public API - Model Management
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
    this.modelLoader.removeModel(modelId, (batching) => {
      unbatch(batching);
    });
  }

  // Public API - GUID Search & Focus
  findMeshesByGUIDs(guids: string[]): THREE.Mesh[] {
    return this.guidCtrl.findMeshesByGUIDs(guids);
  }

  focusOnObjects(objects: THREE.Mesh[], animated: boolean = true): void {
    this.guidCtrl.focusOnObjects(objects, animated);
  }

  findAndFocusByGUIDs(guids: string[]): { found: THREE.Mesh[], notFound: number } {
    return this.guidCtrl.findAndFocusByGUIDs(guids);
  }

  clearGuidHighlights(): void {
    this.guidCtrl.clearGuidHighlights();
  }

  addGuidHighlights(meshes: THREE.Mesh[]): void {
    this.guidCtrl.addGuidHighlights(meshes);
  }

  getGuidSelectedMeshes(): THREE.Mesh[] {
    return this.guidCtrl.getGuidSelectedMeshes();
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  // Debug utilities
  listAllGUIDs(): void {
    this.guidCtrl.listAllGUIDs();
  }

  inspectModelUserData(): void {
    this.guidCtrl.inspectModelUserData();
  }

  // Internals
  private get scene(): THREE.Scene {
    return this.world.scene!.three as unknown as THREE.Scene;
  }

  private get renderer(): THREE.WebGLRenderer {
    return this.world.renderer!.three as unknown as THREE.WebGLRenderer;
  }

  private get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.world.camera!.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  }

  private animationLoop = () => {
    this.cullingCtrl.update();
    (this.world.renderer as any).update?.();
    this.rafId = requestAnimationFrame(this.animationLoop);
  };

  private onResize = () => {
    if ((this as any)._resizeTimeout) {
      clearTimeout((this as any)._resizeTimeout);
    }
    (this as any)._resizeTimeout = setTimeout(() => {
      this.world.renderer?.resize();
      (this as any)._resizeTimeout = null;
    }, 100);
  };

  private onPointerDown = () => {
    this.adaptiveRes.onInteractionStart();
  };

  private onPointerUp = () => {
    this.adaptiveRes.onInteractionEnd();
  };

  private onWheel = () => {
    this.adaptiveRes.onInteractionStart();
  };

  private supportsUint32Indices(): boolean {
    const gl = this.renderer.getContext() as WebGLRenderingContext | WebGL2RenderingContext;
    const isWebGL2 = (gl as WebGL2RenderingContext).drawBuffers !== undefined || (gl as any).VERSION === 2;
    if (isWebGL2) return true;
    return !!(gl as WebGLRenderingContext).getExtension && !!(gl as WebGLRenderingContext).getExtension('OES_element_index_uint');
  }

  private clearPreviousModel() {
    this.modelLoader.clearPreviousModels();
    if (this.currentBatching) {
      unbatch(this.currentBatching);
      this.currentBatching = null;
    }
    this.edgeCtrl.removeAllEdgeOverlays();
    this.edgeCtrl.clearEdgesCache();
    this.edgeCtrl.resetFirstEdgesBuildTimer();
    this.selection.clear();
    this.cullingCtrl.clear();
  }

  // Optional viewer-level subscriptions for Clipper events (unused but kept for API compatibility)
  onClipAfterCreate(_handler: (plane: OBC.SimplePlane) => void) { }
  onClipAfterDelete(_handler: (plane: OBC.SimplePlane) => void) { }
  onClipAfterCancel(_handler: () => void) { }
  onClipAfterDrag(_handler: () => void) { }
}
