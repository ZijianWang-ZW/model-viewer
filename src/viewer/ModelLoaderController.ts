import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { batchMeshes, unbatch, type BatchingResult } from '../batching';
import type { ModelManager, DisciplineType } from '../modelManager';
import type { SimpleCamera } from '@thatopen/components';

export interface ModelLoaderOptions {
  batchingEnabled: boolean;
  allow32Bit: boolean;
  maxVerticesPerBatch: number;
}

/**
 * Controller for loading and managing GLB model files
 */
export class ModelLoaderController {
  private scene: THREE.Scene;
  private camera: SimpleCamera;
  private loader = new GLTFLoader();
  private modelManager: ModelManager;

  constructor(scene: THREE.Scene, camera: SimpleCamera, modelManager: ModelManager) {
    this.scene = scene;
    this.camera = camera;
    this.modelManager = modelManager;
  }

  /**
   * Load a GLB file from a File object
   */
  async loadGLBFile(
    file: File,
    discipline: DisciplineType | undefined,
    options: ModelLoaderOptions,
    onEdgesAdd?: () => void
  ): Promise<{ root: THREE.Group, batching: BatchingResult | null }> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      (root as any).userData.isUserModel = true;
      
      const toMark: (THREE.Mesh | THREE.InstancedMesh)[] = [];
      root.traverse(o => {
        // Mark both regular Mesh and InstancedMesh (GPU instancing)
        if ((o as any).isMesh || (o as any).isInstancedMesh) {
          toMark.push(o as THREE.Mesh | THREE.InstancedMesh);
        }
      });
      for (const m of toMark) {
        (m as any).userData = (m as any).userData || {};
        (m as any).userData.isUserModel = true;
      }
      
      this.scene.add(root);

      let batching: BatchingResult | null = null;
      if (options.batchingEnabled) {
        batching = batchMeshes(root, {
          allow32Bit: options.allow32Bit,
          maxVerticesPerBatch: options.maxVerticesPerBatch
        }) || null;
      }

      if (discipline) {
        const modelId = this.modelManager.addModel(file.name, discipline, root, batching);
        (root as any).userData.modelId = modelId;
      }

      if (onEdgesAdd) onEdgesAdd();

      window.dispatchEvent(new CustomEvent('viewer:modelLoaded', { detail: { discipline } }));

      return { root, batching };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Load additional model without clearing existing ones
   */
  async loadAdditionalModel(
    file: File,
    discipline: DisciplineType,
    options: ModelLoaderOptions,
    onEdgesAdd?: () => void
  ): Promise<{ modelId: string, root: THREE.Group, batching: BatchingResult | null }> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      (root as any).userData.isUserModel = true;
      
      const toMark: (THREE.Mesh | THREE.InstancedMesh)[] = [];
      root.traverse(o => {
        // Mark both regular Mesh and InstancedMesh (GPU instancing)
        if ((o as any).isMesh || (o as any).isInstancedMesh) {
          toMark.push(o as THREE.Mesh | THREE.InstancedMesh);
        }
      });
      for (const m of toMark) {
        (m as any).userData = (m as any).userData || {};
        (m as any).userData.isUserModel = true;
      }
      
      this.scene.add(root);

      let batching: BatchingResult | null = null;
      if (options.batchingEnabled) {
        batching = batchMeshes(root, {
          allow32Bit: options.allow32Bit,
          maxVerticesPerBatch: options.maxVerticesPerBatch
        }) || null;
      }

      const modelId = this.modelManager.addModel(file.name, discipline, root, batching);
      (root as any).userData.modelId = modelId;

      if (onEdgesAdd) onEdgesAdd();

      window.dispatchEvent(new CustomEvent('viewer:modelLoaded', { detail: { discipline, modelId } }));

      return { modelId, root, batching };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Clear all previous models from scene
   */
  clearPreviousModels(): void {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj: THREE.Object3D) => {
      if ((obj as any).userData?.isUserModel) toRemove.push(obj);
    });
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
  }

  /**
   * Remove a specific model from scene
   */
  removeModel(modelId: string, onBatchUndo?: (batching: BatchingResult) => void): void {
    const model = this.modelManager.removeModel(modelId);
    if (model) {
      this.scene.remove(model.root);
      
      model.root.traverse((child: THREE.Object3D) => {
        const anyChild = child as any;
        if (anyChild.geometry?.dispose) anyChild.geometry.dispose();
        const mat = anyChild.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
        else mat?.dispose?.();
      });

      if (model.batching && onBatchUndo) {
        onBatchUndo(model.batching);
      }

      window.dispatchEvent(new CustomEvent('viewer:modelRemoved', { detail: { modelId } }));
    }
  }

  /**
   * Fit camera to a specific object
   */
  fitCameraToObject(object: THREE.Object3D, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let distance = 10;
    if ((camera as any).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      const fov = persp.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.tan(fov / 2)) * 0.5;
    } else {
      const ortho = camera as THREE.OrthographicCamera;
      const span = maxDim * 1.5;
      ortho.top = span / 2;
      ortho.bottom = -span / 2;
      ortho.left = -span / 2;
      ortho.right = span / 2;
      ortho.updateProjectionMatrix();
      distance = maxDim * 2;
    }

    const dir = new THREE.Vector3(1, 1, 1).normalize();
    const eye = center.clone().add(dir.multiplyScalar(distance));
    this.camera.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z);
  }

  /**
   * Fit camera to all loaded models
   */
  fitCameraToAllModels(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    const box = new THREE.Box3();
    let hasAny = false;
    
    this.scene.traverse(o => {
      // Support both regular Mesh and InstancedMesh
      const isMesh = (o as any).isMesh;
      const isInstancedMesh = (o as any).isInstancedMesh;
      if ((isMesh || isInstancedMesh) && (o as any).userData?.isUserModel && !(o as any).userData?.isEdgeOverlay) {
        box.expandByObject(o);
        hasAny = true;
      }
    });

    if (!hasAny) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let distance = 10;
    if ((camera as any).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      const fov = persp.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.tan(fov / 2)) * 0.5;
    } else {
      const ortho = camera as THREE.OrthographicCamera;
      const span = maxDim * 1.5;
      ortho.top = span / 2;
      ortho.bottom = -span / 2;
      ortho.left = -span / 2;
      ortho.right = span / 2;
      ortho.updateProjectionMatrix();
      distance = maxDim * 2;
    }

    const dir = new THREE.Vector3(1, 1, 1).normalize();
    const eye = center.clone().add(dir.multiplyScalar(distance));
    this.camera.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z);
  }
}

