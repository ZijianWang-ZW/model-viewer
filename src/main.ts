import * as THREE from 'three';
import { Viewer } from './viewer/Viewer';
import { installClippingUI } from './clipping';
import { installEdgesUI } from './edges';
import { installHighlightUI } from './highlight';
import type { DisciplineType } from './modelManager';

const container = document.getElementById('container')!;
const viewer = new Viewer(container);

// Discipline modal state
let pendingFile: File | null = null;
let selectedDiscipline: DisciplineType | null = null;

// Stats updater
const meshesEl = document.getElementById('stat-meshes') as HTMLElement | null;
const batchesEl = document.getElementById('stat-batches') as HTMLElement | null;
const loadSecEl = document.getElementById('stat-loadsec') as HTMLElement | null;
const materialsEl = document.getElementById('stat-materials') as HTMLElement | null;
const edgesSecEl = document.getElementById('stat-edgessec') as HTMLElement | null;
const batchesBtn = document.getElementById('stat-batches-btn') as HTMLButtonElement | null;
const batchesPanel = document.getElementById('batch-details') as HTMLElement | null;
const edgesBanner = document.getElementById('edges-banner') as HTMLElement | null;
const unbatchedEl = document.getElementById('stat-unbatched') as HTMLElement | null;
const highlightedEl = document.getElementById('stat-highlighted') as HTMLElement | null;
function updateStats() {
  if (!meshesEl) return;
  const s = viewer.getStats();
  meshesEl.textContent = String(s.originalMeshes);
  const bText = String(s.batches);
  if (batchesBtn) batchesBtn.textContent = bText; else if (batchesEl) batchesEl.textContent = bText;
  if (materialsEl) materialsEl.textContent = String(s.uniqueMaterials);
  if (unbatchedEl) unbatchedEl.textContent = String(s.unbatchedOriginals);
  if (highlightedEl) highlightedEl.textContent = String(viewer.getHighlightedCount());
}

// Discipline modal setup
const disciplineModal = document.getElementById('discipline-modal')!;
const disciplineOptions = document.querySelectorAll('.discipline-option');
const disciplineConfirm = document.getElementById('discipline-confirm') as HTMLButtonElement;
const disciplineCancel = document.getElementById('discipline-cancel')!;
const fileInput = document.getElementById('file') as HTMLInputElement;

const resetDisciplineModal = () => {
  disciplineModal.classList.remove('active');
  disciplineOptions.forEach(opt => opt.classList.remove('selected'));
  disciplineConfirm.disabled = true;
  pendingFile = null;
  selectedDiscipline = null;
  fileInput.value = '';
};

// Discipline selection handlers
disciplineOptions.forEach(option => {
  option.addEventListener('click', () => {
    disciplineOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedDiscipline = option.getAttribute('data-discipline') as DisciplineType;
    disciplineConfirm.disabled = false;
  });
});

disciplineCancel.addEventListener('click', resetDisciplineModal);

disciplineConfirm.addEventListener('click', async () => {
  if (!pendingFile || !selectedDiscipline) return;
  
  disciplineModal.classList.remove('active');
  const t0 = performance.now();
  
  await (viewer.getModelManager().hasModels()
    ? viewer.loadAdditionalModel(pendingFile, selectedDiscipline)
    : viewer.loadGLBFromFile(pendingFile, selectedDiscipline));
  
  if (loadSecEl) loadSecEl.textContent = ((performance.now() - t0) / 1000).toFixed(2);
  updateStats();
  updateModelsPanel();
  refreshBatchDetailsIfOpen();
  resetDisciplineModal();
});

// File open
document.getElementById('open')!.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    pendingFile = file;
    disciplineModal.classList.add('active');
  }
});

// Edges toggle button logic
installEdgesUI(viewer);

// Batching toggle button logic
const batchingBtn = document.getElementById('toggle-batching');
const batchVerticesInput = document.getElementById('batch-vertices') as HTMLInputElement | null;
const batchInputWrap = document.getElementById('batch-input-wrap') as HTMLElement | null;

if (batchingBtn && batchInputWrap) {
  const setBatchingUI = (enabled: boolean) => {
    batchingBtn.setAttribute('data-active', enabled ? 'true' : 'false');
    batchingBtn.textContent = `Batching: ${enabled ? 'On' : 'Off'}`;
    batchInputWrap.style.display = enabled ? 'inline-flex' : 'none';
    viewer.setBatchingEnabled(enabled);
  };

  // Initialize with current state (batching is on by default)
  setBatchingUI(viewer.isBatchingEnabled());

  batchingBtn.addEventListener('click', () => {
    setBatchingUI(!viewer.isBatchingEnabled());
    updateStats();
    refreshBatchDetailsIfOpen();
  });
}

// Bind batch vertices input
if (batchVerticesInput) {
  const applyBatchVertices = () => {
    const v = parseInt(batchVerticesInput.value);
    if (!isNaN(v) && v >= 100 && v <= 100000) {
      viewer.setMaxVerticesPerBatch(v);
    }
  };

  const rebuildBatchingIfEnabled = () => {
    const v = parseInt(batchVerticesInput.value);
    if (!isNaN(v) && v >= 100 && v <= 100000) {
      viewer.setMaxVerticesPerBatch(v);

      // Only rebuild if batching is currently enabled
      if (viewer.isBatchingEnabled()) {
        viewer.rebuildBatching();
        updateStats();
        refreshBatchDetailsIfOpen();
      }
    }
  };

  // Update setting on change, don't rebuild
  batchVerticesInput.addEventListener('change', applyBatchVertices);

  // Rebuild on Enter key press (only if batching is enabled)
  batchVerticesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      rebuildBatchingIfEnabled();
    }
  });

  batchVerticesInput.value = String(viewer.getMaxVerticesPerBatch());
}

// Culling toggle and UI show/hide
const cullToggle = document.getElementById('toggle-cull');
const cullWrap = document.getElementById('cull-input-wrap') as HTMLElement | null;
const thresholdInput = document.getElementById('cull-threshold') as HTMLInputElement | null;
if (cullToggle && cullWrap) {
  const setCullUi = (enabled: boolean) => {
    cullToggle.setAttribute('data-active', enabled ? 'true' : 'false');
    cullToggle.textContent = `Cull: ${enabled ? 'On' : 'Off'}`;
    cullWrap.style.display = enabled ? 'inline-flex' : 'none';
    viewer.setCullingEnabled(enabled);
  };
  setCullUi(false);
  cullToggle.addEventListener('click', () => {
    setCullUi(!viewer.isCullingEnabled());
    updateStats();
  });
}

// Bind threshold input (default 50)
if (thresholdInput) {
  const applyThreshold = () => {
    const v = parseFloat(thresholdInput.value);
    if (!isNaN(v) && v >= 0) viewer.setCullingThreshold(v);
  };
  thresholdInput.addEventListener('change', applyThreshold);
  thresholdInput.addEventListener('input', applyThreshold);
  thresholdInput.value = '50';
  applyThreshold();
}

// Dragging smooth time input (0..0.5; default 0.05)
const dragInput = document.getElementById('drag-smooth') as HTMLInputElement | null;
if (dragInput) {
  const applyDrag = () => {
    const v = parseFloat(dragInput.value);
    if (!isNaN(v)) viewer.setDraggingSmoothTime(v);
  };
  dragInput.addEventListener('change', applyDrag);
  dragInput.addEventListener('input', applyDrag);
}

// Zoom speed multiplier
const zoomInput = document.getElementById('zoom-speed') as HTMLInputElement | null;
if (zoomInput) {
  const applyZoom = () => {
    const v = parseFloat(zoomInput.value);
    if (!isNaN(v)) viewer.setZoomSpeed(v);
  };
  zoomInput.addEventListener('change', applyZoom);
  zoomInput.addEventListener('input', applyZoom);
}

// Adaptive resolution toggle button (default Off)
const adaptiveBtn = document.getElementById('toggle-adaptive');
if (adaptiveBtn) {
  adaptiveBtn.setAttribute('data-active', 'false');
  adaptiveBtn.textContent = 'Adaptive Res: Off';
  adaptiveBtn.addEventListener('click', () => {
    const next = !viewer.isAdaptiveEnabled();
    viewer.setAdaptiveEnabled(next);
    adaptiveBtn.setAttribute('data-active', next ? 'true' : 'false');
    adaptiveBtn.textContent = `Adaptive Res: ${next ? 'On' : 'Off'}`;
    updateStats();
  });
}

// Clipping controls
installClippingUI(viewer);

// Highlighting controls
installHighlightUI(viewer.getHighlightController());

updateStats();

function refreshBatchDetailsIfOpen() {
  if (!batchesBtn || !batchesPanel) return;
  if (batchesBtn.getAttribute('data-open') !== 'true') return;
  renderBatchDetails();
}

function renderBatchDetails() {
  if (!batchesPanel) return;
  const details = viewer.getBatchDetails();
  const parts: string[] = [];
  for (let i = 0; i < details.length; i++) {
    parts.push(`<div class="bd-row"><span class="key">Batch ${i + 1}</span><span class="val">${details[i].originalCount}</span></div>`);
  }
  batchesPanel.innerHTML = parts.join('');
}

if (batchesBtn && batchesPanel) {
  batchesBtn.addEventListener('click', () => {
    const open = batchesBtn.getAttribute('data-open') === 'true';
    const next = !open;
    batchesBtn.setAttribute('data-open', next ? 'true' : 'false');
    batchesPanel.style.display = next ? 'block' : 'none';
    if (next) renderBatchDetails();
  });
}

// Listen for first-time edges build duration
window.addEventListener('viewer:edgesBuilt', (e: any) => {
  const ms = e?.detail?.ms as number | undefined;
  if (typeof ms === 'number' && edgesSecEl) edgesSecEl.textContent = (ms / 1000).toFixed(2);
  if (edgesBanner) edgesBanner.style.display = 'none';
});

// Listen for highlight changes to update stats
window.addEventListener('viewer:highlightChanged', () => {
  updateStats();
});

// Models panel setup
const modelsList = document.getElementById('models-list')!;
const modelCount = document.getElementById('model-count')!;
const allModelsToggle = document.getElementById('all-models-toggle')!;

const DISCIPLINE_ICONS: Record<DisciplineType, string> = {
  Architecture: '🏛️', Structure: '🏗️', Mechanical: '⚙️',
  Electrical: '⚡', Plumbing: '🚰', Other: '📦'
};

const EYE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

function updateModelsPanel() {
  const models = viewer.getModelManager().getAllModels();
  modelCount.textContent = String(models.length);
  
  // Update "All" toggle
  allModelsToggle.querySelector('.visibility-icon')!.classList.toggle('hidden', 
    !viewer.getModelManager().areAllModelsVisible());
  
  // Clear and rebuild model list
  modelsList.querySelectorAll('.model-item:not(.all-item)').forEach(el => el.remove());
  
  models.forEach(model => {
    const item = document.createElement('div');
    item.className = 'model-item';
    item.innerHTML = `
      <div class="visibility-icon ${model.visible ? '' : 'hidden'}" title="Toggle">${EYE_ICON}</div>
      <span class="discipline-icon-small">${DISCIPLINE_ICONS[model.discipline]}</span>
      <span class="model-name" title="${model.name}">${model.discipline}</span>
      <button class="model-action-btn remove-btn" title="Remove">×</button>
    `;
    
    item.querySelector('.visibility-icon')!.addEventListener('click', () => {
      viewer.setModelVisibility(model.id, !model.visible);
      updateModelsPanel();
    });
    
    item.querySelector('.remove-btn')!.addEventListener('click', () => {
      if (confirm(`Remove ${model.discipline}?`)) {
        viewer.removeModel(model.id);
        updateModelsPanel();
        updateStats();
      }
    });
    
    modelsList.appendChild(item);
  });
}

allModelsToggle.addEventListener('click', () => {
  viewer.setAllModelsVisibility(!viewer.getModelManager().areAllModelsVisible());
  updateModelsPanel();
});

window.addEventListener('viewer:modelLoaded', updateModelsPanel);
window.addEventListener('viewer:modelRemoved', updateModelsPanel);
updateModelsPanel();

// GUID search functionality
const guidSearchBtn = document.getElementById('guid-search')!;
const guidInput = document.getElementById('guid-input') as HTMLInputElement;
const guidFocusBtn = document.getElementById('guid-focus')!;

guidSearchBtn.addEventListener('click', () => {
  const isActive = guidSearchBtn.getAttribute('data-active') === 'true';
  
  if (!isActive) {
    // Show input and focus button
    guidInput.classList.remove('hidden');
    guidFocusBtn.classList.remove('hidden');
    guidInput.focus();
    guidSearchBtn.setAttribute('data-active', 'true');
    guidSearchBtn.textContent = 'Find by GUID: On';
  } else {
    // Hide input and clear
    guidInput.classList.add('hidden');
    guidFocusBtn.classList.add('hidden');
    guidSearchBtn.setAttribute('data-active', 'false');
    guidSearchBtn.textContent = 'Find by GUID';
    guidInput.value = '';
    // Clear GUID highlights
    viewer.clearGuidHighlights();
  }
});

// Search and highlight on Enter
guidInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    performGuidSearch();
  }
});

// Focus button - trigger search when clicked
guidFocusBtn.addEventListener('click', () => {
  performGuidSearch();
});

function performGuidSearch() {
  const input = guidInput.value.trim();
  if (!input) return;
  
  console.log('[Main] Starting GUID search with input:', input);
  
  // Parse GUIDs - handle both comma-separated and array format
  let guids: string[] = [];
  
  // Remove brackets if present: ['guid1', 'guid2'] -> 'guid1', 'guid2'
  const cleaned = input.replace(/[\[\]'\"]/g, '');
  guids = cleaned.split(',').map(g => g.trim()).filter(g => g.length > 0);
  
  console.log('[Main] Parsed GUIDs:', guids);
  
  if (guids.length === 0) {
    alert('Please enter at least one GUID');
    return;
  }
  
  // Find meshes by GUIDs
  const foundMeshes = viewer.findMeshesByGUIDs(guids);
  
  console.log('[Main] Search result:', foundMeshes);
  
  // Determine which GUIDs were not found
  const foundGuids = new Set<string>();
  foundMeshes.forEach(mesh => {
    const userData = (mesh as any).userData || {};
    const possibleGuids = [
      userData.name,
      mesh.name,
      userData.guid,
      userData.GlobalId,
      userData.expressID,
      userData.ifcGuid,
      userData.GUID
    ].filter(Boolean).map(g => String(g).toLowerCase());
    
    guids.forEach(searchGuid => {
      if (possibleGuids.includes(searchGuid.toLowerCase())) {
        foundGuids.add(searchGuid);
      }
    });
  });
  
  const notFoundGuids = guids.filter(g => !foundGuids.has(g));
  
  // Highlight found objects
  if (foundMeshes.length > 0) {
    viewer.clearGuidHighlights();
    viewer.addGuidHighlights(foundMeshes);
    viewer.focusOnObjects(foundMeshes, true);
    
    // Show feedback
    if (notFoundGuids.length > 0) {
      const message = `Found ${foundMeshes.length} of ${guids.length} objects`;
      showGuidSearchFeedback(message);
      alert(`⚠️ GUIDs not found:\n\n${notFoundGuids.join('\n')}\n\n✅ Found ${foundMeshes.length} object(s)`);
    } else {
      const message = `Found all ${foundMeshes.length} objects!`;
      showGuidSearchFeedback(message);
    }
    
    console.log('[Main] Success - Found:', foundGuids);
    console.log('[Main] Not found:', notFoundGuids);
  } else {
    const message = `❌ No objects found for any of the provided GUIDs:\n\n${guids.join('\n')}`;
    console.error('[Main] Not found:', message);
    alert(message);
  }
}

// Add debug helper to window for console access
(window as any).debugViewer = {
  listGUIDs: () => viewer.listAllGUIDs(),
  inspect: () => viewer.inspectModelUserData(),
  searchGUID: (guid: string) => {
    const result = viewer.findAndFocusByGUIDs([guid]);
    console.log('Search result:', result);
    return result;
  },
  searchByName: (namePattern: string) => {
    const meshes: THREE.Mesh[] = [];
    const scene = viewer.getScene();
    scene.traverse((obj: any) => {
      if (!obj.isMesh) return;
      if (!obj.userData?.isUserModel) return;
      if (!obj.userData?.isMergedBatch) return;
      if (!obj.userData?.isEdgeOverlay) return;
      if (obj.name.toLowerCase().includes(namePattern.toLowerCase())) {
        meshes.push(obj);
      }
    });
    console.log(`Found ${meshes.length} meshes matching "${namePattern}":`, meshes);
    if (meshes.length > 0) {
      viewer.focusOnObjects(meshes, true);
      viewer.clearGuidHighlights();
      viewer.addGuidHighlights(meshes);
    }
    return meshes;
  }
};

function showGuidSearchFeedback(message: string) {
  // Reuse edges banner for feedback
  const banner = document.getElementById('edges-banner');
  if (banner) {
    banner.textContent = message;
    banner.style.display = 'block';
    banner.style.background = 'rgba(101, 40, 215, 0.9)';
    setTimeout(() => {
      banner.style.display = 'none';
      banner.style.background = '';
    }, 3000);
  }
}
