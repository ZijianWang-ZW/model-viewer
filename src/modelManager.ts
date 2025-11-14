import * as THREE from 'three';
import type { BatchingResult } from './batching';

export type DisciplineType = 'Architecture' | 'Structure' | 'Mechanical' | 'Electrical' | 'Plumbing' | 'Other';

export interface ModelData {
  id: string;
  name: string;
  discipline: DisciplineType;
  root: THREE.Group;
  batching: BatchingResult | null;
  visible: boolean;
}

export class ModelManager {
  private models = new Map<string, ModelData>();
  private nextId = 1;

  addModel(name: string, discipline: DisciplineType, root: THREE.Group, batching: BatchingResult | null): string {
    const id = `model_${this.nextId++}`;
    this.models.set(id, { id, name, discipline, root, batching, visible: true });
    return id;
  }

  removeModel(id: string): ModelData | null {
    const model = this.models.get(id);
    if (model) this.models.delete(id);
    return model || null;
  }

  getAllModels(): ModelData[] {
    return Array.from(this.models.values());
  }

  setModelVisibility(id: string, visible: boolean): void {
    const model = this.models.get(id);
    if (model) {
      model.visible = visible;
      model.root.visible = visible;
    }
  }

  setAllModelsVisibility(visible: boolean): void {
    this.models.forEach(model => {
      model.visible = visible;
      model.root.visible = visible;
    });
  }

  hasModels(): boolean {
    return this.models.size > 0;
  }

  areAllModelsVisible(): boolean {
    return this.models.size > 0 && Array.from(this.models.values()).every(m => m.visible);
  }
}

