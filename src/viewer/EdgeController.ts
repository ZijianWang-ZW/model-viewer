import * as THREE from 'three';

/**
 * Controller for edge overlay management
 */
export class EdgeController {
  private scene: THREE.Scene;
  private edgesEnabled = false;
  private edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, depthTest: true });
  private edgesCache = new Map<string, THREE.EdgesGeometry>();
  private firstEdgesBuildMs: number | null = null;

  private static readonly EDGE_THRESHOLD_ANGLE_DETAILED = 1;
  private static readonly EDGE_THRESHOLD_ANGLE_MERGED = 25;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    (this.scene as any).userData = (this.scene as any).userData || {};
    (this.scene as any).userData.edgesEnabled = this.edgesEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.edgesEnabled = enabled;
    (this.scene as any).userData.edgesEnabled = enabled;
    
    window.dispatchEvent(new CustomEvent('viewer:edgesToggled', { detail: { enabled } }));
    
    if (enabled) {
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
      this.setEdgeOverlaysVisible(false);
    }
  }

  isEnabled(): boolean {
    return this.edgesEnabled;
  }

  hasBuiltEdges(): boolean {
    return this.firstEdgesBuildMs !== null;
  }

  addEdgesForCurrentModel(): void {
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
      const egeom = this.getOrCreateEdgesGeometry(
        mesh.geometry as THREE.BufferGeometry,
        EdgeController.EDGE_THRESHOLD_ANGLE_DETAILED
      );
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
      const egeom = this.getOrCreateEdgesGeometry(
        geom,
        EdgeController.EDGE_THRESHOLD_ANGLE_MERGED
      );
      const lines = new THREE.LineSegments(egeom, this.edgesMaterial.clone());
      (lines as any).userData.isUserModel = true;
      (lines as any).userData.isEdgeOverlay = true;
      (lines as any).userData.isMergedEdgeOverlay = true;
      (lines as any).renderOrder = 1;
      mesh.add(lines);
    }
  }

  removeAllEdgeOverlays(): void {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse(o => {
      if ((o as any).userData?.isEdgeOverlay) toRemove.push(o);
    });
    toRemove.forEach(e => {
      const lines = e as THREE.LineSegments;
      const mat = lines.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
      else mat?.dispose?.();
      e.parent?.remove(e);
    });
  }

  private setEdgeOverlaysVisible(visible: boolean): void {
    this.scene.traverse(o => {
      if ((o as any).userData?.isEdgeOverlay) {
        (o as any).visible = visible;
      }
    });
  }

  private getOrCreateEdgesGeometry(geometry: THREE.BufferGeometry, threshold: number): THREE.EdgesGeometry {
    const key = geometry.uuid + ':' + threshold;
    let geom = this.edgesCache.get(key);
    if (!geom) {
      geom = new THREE.EdgesGeometry(geometry, threshold);
      this.edgesCache.set(key, geom);
    }
    return geom;
  }

  clearEdgesCache(): void {
    this.edgesCache.forEach(g => g.dispose());
    this.edgesCache.clear();
  }

  resetFirstEdgesBuildTimer(): void {
    this.firstEdgesBuildMs = null;
  }

  private emitEdgesBuildTime(): void {
    if (this.firstEdgesBuildMs == null) return;
    const ev = new CustomEvent('viewer:edgesBuilt', { detail: { ms: this.firstEdgesBuildMs } });
    window.dispatchEvent(ev);
  }

  dispose(): void {
    this.removeAllEdgeOverlays();
    this.clearEdgesCache();
  }
}

