// C:\Users\Álvaro Amorim\app-3d-educativo\src\renderer.js
// Versão: Completa com troca de clique simples/duplo para anotações

// Importa o CSS principal
import './index.css';
// Importa o componente model-viewer diretamente do node_modules
import '../node_modules/@google/model-viewer/dist/model-viewer.js';

// --- 1. Referências aos Elementos do DOM ---

// Elemento principal do viewer 3D
const modelViewer = document.getElementById('viewer');
// Parágrafo para exibir mensagens de status
const statusLog = document.querySelector('#status-log p');

// Botões principais da interface
const btnLoadFile = document.getElementById('btn-load-file');
const btnToggleAnnotation = document.getElementById('btn-toggle-annotation');
const btnSaveState = document.getElementById('btn-save-state');
const btnLoadState = document.getElementById('btn-load-state');

// Elementos do Modal (pop-up) para adicionar/editar anotações
const modalBackdrop = document.getElementById('annotation-modal-backdrop');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalTitleInput = document.getElementById('annotation-title');
const modalTextInput = document.getElementById('annotation-text');

// --- 2. Variáveis de Estado Globais ---

// Contador para gerar IDs únicos para novas anotações (hotspots)
let hotspotCounter = 3;
// Guarda dados temporários ao criar ou editar uma anotação.
let currentAnnotationData = null;
// Flag booleana que indica se o modo de anotação está ativo.
let isAnnotationModeActive = false;
// Guarda o URL do Blob do modelo carregado via ficheiro.
let currentModelBlobUrl = null;

// --- 3. Funções Auxiliares ---

/**
 * Atualiza o texto na barra de status da aplicação.
 * @param {string} message - A mensagem a ser exibida.
 */
const updateStatus = (message) => {
  if (message.startsWith('Status:') || message.startsWith('Erro:')) {
    statusLog.textContent = message;
  } else {
    statusLog.textContent = `Status: ${message}`;
  }
};

// --- 4. Funções Principais ---

/**
 * Carrega um modelo .glb selecionado pelo utilizador.
 */
const loadModelFromFile = async () => {
  console.log('--- loadModelFromFile function called ---');
  try {
    updateStatus('A abrir janela de seleção...');
    console.log('Calling window.electronAPI.openFile()...');
    const fileDataBuffer = await window.electronAPI.openFile();

    if (!fileDataBuffer) {
      updateStatus('Seleção cancelada ou erro ao ler o ficheiro.');
      console.log('File selection canceled or read error.');
      return;
    }

    console.log('File data received (Buffer). Converting to Blob...');
    const blob = new Blob([fileDataBuffer], { type: 'model/gltf-binary' });
    const objectURL = URL.createObjectURL(blob);
    console.log('Blob URL created:', objectURL);

    if (currentModelBlobUrl) {
      console.log('Revoking old Blob URL:', currentModelBlobUrl);
      URL.revokeObjectURL(currentModelBlobUrl);
    }
    currentModelBlobUrl = objectURL;

    console.log('Setting modelViewer.src and environmentImage...');
    modelViewer.src = objectURL;
    modelViewer.environmentImage = '/assets/environment.hdr';
    updateStatus('Modelo a carregar...');

  } catch (error) {
    console.error('!!! Error inside loadModelFromFile:', error);
    updateStatus(`Erro ao carregar ficheiro: ${error.message}`);
  }
};

/**
 * Ativa ou desativa o modo de anotação e mostra/esconde hotspots.
 */
const toggleAnnotations = () => {
  isAnnotationModeActive = !isAnnotationModeActive;
  console.log('Annotation mode toggled. New state:', isAnnotationModeActive);

  const allAnnotations = modelViewer.querySelectorAll('div[slot^="hotspot-"]');
  allAnnotations.forEach((spot) => {
    spot.classList.toggle('annotation-visible', isAnnotationModeActive);
  });

  updateStatus(isAnnotationModeActive ? 'Modo de Anotação ATIVADO. Clique DUPLO no modelo para adicionar notas. Clique simples para editar/apagar.' : 'Modo de Anotação DESATIVADO.');
};

/**
 * Mostra o modal para adicionar ou editar uma anotação.
 * @param {object | null} data - Dados para criação ({position, normal}) ou edição ({elementToEdit}).
 */
const showAnnotationModal = (data) => {
  console.log('Showing modal for:', data);
  currentAnnotationData = data;
  if (data && data.elementToEdit) {
    const titleEl = data.elementToEdit.querySelector('h3');
    const textEl = data.elementToEdit.querySelector('p');
    modalTitleInput.value = titleEl ? titleEl.innerText : '';
    modalTextInput.value = textEl ? textEl.innerText : '';
    modalBackdrop.querySelector('h2').innerText = "Editar Anotação";
  } else {
    modalTitleInput.value = '';
    modalTextInput.value = '';
    modalBackdrop.querySelector('h2').innerText = "Adicionar Anotação";
  }
  modalBackdrop.classList.remove('modal-hidden');
  modalTitleInput.focus();
};

/**
 * Esconde o modal de anotação.
 */
const hideAnnotationModal = () => {
  currentAnnotationData = null;
  modalBackdrop.classList.add('modal-hidden');
};

/**
 * Prepara para editar uma anotação existente.
 * @param {HTMLElement} hotspotElement - O elemento da anotação clicada.
 */
const startEditAnnotation = (hotspotElement) => {
  showAnnotationModal({ elementToEdit: hotspotElement });
};

/**
 * Cria uma nova anotação ou atualiza uma existente (chamada pelo modal).
 */
const saveAnnotation = () => {
  if (!currentAnnotationData) return;
  const title = modalTitleInput.value.trim();
  const text = modalTextInput.value.trim();
  if (!title) { alert("Por favor, insira um título."); return; }

  if (currentAnnotationData.elementToEdit) {
    // Modo Edição
    const element = currentAnnotationData.elementToEdit;
    const titleEl = element.querySelector('h3');
    const textEl = element.querySelector('p');
    if (titleEl) titleEl.innerText = title;
    if (textEl) {
        if (text) textEl.innerText = text;
        else textEl.remove();
    } else if (text) {
        const newTextEl = document.createElement('p');
        newTextEl.innerText = text;
        element.appendChild(newTextEl);
    }
    updateStatus(`Anotação "${title}" atualizada!`);
  } else {
    // Modo Criação
    const { position, normal } = currentAnnotationData;
    const newHotspot = document.createElement('div');
    newHotspot.slot = `hotspot-${hotspotCounter}`;
    newHotspot.dataset.position = `${position.x} ${position.y} ${position.z}`;
    newHotspot.dataset.normal = `${normal.x} ${normal.y} ${normal.z}`;
    newHotspot.innerHTML = `
      <button class="delete-btn">X</button>
      <h3>${title}</h3>
      ${text ? `<p>${text}</p>` : ''}
    `;
    newHotspot.classList.add('annotation-visible');
    modelViewer.appendChild(newHotspot);
    hotspotCounter++;
    updateStatus(`Anotação "${title}" criada!`);
  }
  hideAnnotationModal();
};

/**
 * Salva o estado (câmara + anotações) no localStorage.
 */
const saveState = () => {
  console.log('--- saveState function called ---');
  try {
    const orbit = modelViewer.getCameraOrbit();
    const annotationsData = [];
    const annotationElements = modelViewer.querySelectorAll('div[slot^="hotspot-"]');
    console.log(`Found ${annotationElements.length} annotations to save.`);
    annotationElements.forEach((spot) => {
      const titleEl = spot.querySelector('h3');
      const textEl = spot.querySelector('p');
      annotationsData.push({
        slot: spot.slot,
        position: spot.dataset.position,
        normal: spot.dataset.normal,
        title: titleEl ? titleEl.innerText : '',
        text: textEl ? textEl.innerText : '',
      });
    });
    const state = {
      cameraOrbit: orbit.toString(),
      fieldOfView: modelViewer.getFieldOfView(),
      annotations: annotationsData,
    };
    console.log('Saving state:', JSON.stringify(state, null, 2));
    localStorage.setItem('modelViewerState', JSON.stringify(state));
    updateStatus('Estado (Câmara + Anotações) salvo!');
  } catch (error) {
    console.error('!!! Error inside saveState:', error);
    updateStatus(`Erro ao salvar: ${error.message}`);
  }
};

/**
 * Carrega o estado (câmara + anotações) do localStorage.
 */
const loadState = () => {
  console.log('--- loadState function called ---');
  try {
    const savedStateJSON = localStorage.getItem('modelViewerState');
    if (!savedStateJSON) {
      updateStatus('Nenhum estado salvo encontrado.');
      console.log('No saved state found in localStorage.');
      return;
    }
    console.log('Found saved state JSON:', savedStateJSON);
    const savedState = JSON.parse(savedStateJSON);
    console.log('Parsed saved state:', savedState);

    if (savedState.cameraOrbit) modelViewer.cameraOrbit = savedState.cameraOrbit;
    if (savedState.fieldOfView) modelViewer.fieldOfView = savedState.fieldOfView;

    const oldAnnotations = modelViewer.querySelectorAll('div[slot^="hotspot-"]');
    console.log(`Removing ${oldAnnotations.length} old annotations before loading.`);
    oldAnnotations.forEach(spot => spot.remove());

    let maxId = 0;
    if (savedState.annotations && Array.isArray(savedState.annotations)) {
      console.log(`Recreating ${savedState.annotations.length} annotations...`);
      savedState.annotations.forEach(data => {
        if (!data.slot || !data.position) {
            console.warn('Skipping invalid annotation data:', data);
            return;
        }
        const newHotspot = document.createElement('div');
        newHotspot.slot = data.slot;
        newHotspot.dataset.position = data.position;
        if (data.normal) newHotspot.dataset.normal = data.normal;
        newHotspot.innerHTML = `
          <button class="delete-btn">X</button>
          <h3>${data.title || 'Sem Título'}</h3>
          ${data.text ? `<p>${data.text}</p>` : ''}
        `;
        if (isAnnotationModeActive) {
          newHotspot.classList.add('annotation-visible');
        }
        modelViewer.appendChild(newHotspot);
        try {
          const id = parseInt(data.slot.replace('hotspot-', ''), 10);
          if (!isNaN(id) && id > maxId) { maxId = id; }
        } catch (e) { /* Ignora */ }
      });
    } else {
        console.log('No annotations found in saved state.');
    }

    hotspotCounter = maxId + 1;
    console.log('Hotspot counter reset to:', hotspotCounter);
    updateStatus('Estado (Câmara + Anotações) carregado!');
  } catch (error) {
    console.error('!!! Error inside loadState:', error);
    updateStatus(`Erro ao carregar: ${error.message}`);
  }
};

// --- 5. Adicionar "Ouvintes" de Eventos ---

// Liga botões da App
console.log('Attaching event listeners to buttons...');
if (btnLoadFile) btnLoadFile.addEventListener('click', loadModelFromFile);
else console.error('!!! btnLoadFile not found');
if (btnToggleAnnotation) btnToggleAnnotation.addEventListener('click', toggleAnnotations);
else console.error('!!! btnToggleAnnotation not found');
if (btnSaveState) btnSaveState.addEventListener('click', saveState);
else console.error('!!! btnSaveState not found');
if (btnLoadState) btnLoadState.addEventListener('click', loadState);
else console.error('!!! btnLoadState not found');

// Liga botões do Modal
if (modalBtnSave) modalBtnSave.addEventListener('click', saveAnnotation);
else console.error('!!! modalBtnSave not found');
if (modalBtnCancel) modalBtnCancel.addEventListener('click', hideAnnotationModal);
else console.error('!!! modalBtnCancel not found');
console.log('Button listeners attached.');


// --- 6. Ouvintes de Eventos do Model-Viewer ---

// Eventos 'load' e 'error'
modelViewer.addEventListener('load', () => { updateStatus('Modelo carregado com sucesso!'); });
modelViewer.addEventListener('error', (event) => { console.error('Error loading model:', event); updateStatus('Erro: Falha ao carregar modelo.'); });

/**
 * <<< OUVINTE DE CLIQUE MODIFICADO: Só trata de APAGAR ou EDITAR >>>
 */
modelViewer.addEventListener('click', (event) => {
  console.log('--- Single Click Detected --- Target:', event.target);
  const clickedHotspot = event.target.closest('div[slot^="hotspot-"]');
  console.log('Clicked hotspot element:', clickedHotspot);

  // --- LÓGICA DE APAGAR ---
  if (event.target.classList.contains('delete-btn') && clickedHotspot) {
    console.log('Attempting DELETE:', clickedHotspot.slot);
    clickedHotspot.remove();
    updateStatus('Anotação removida.');
    return;
  }

  // --- LÓGICA DE EDITAR ---
  if (clickedHotspot && isAnnotationModeActive) {
    console.log('Attempting EDIT:', clickedHotspot.slot);
    startEditAnnotation(clickedHotspot);
    return;
  }

  // Se não foi apagar nem editar, permite a interação normal da câmara.
  console.log('Single click allows camera interaction.');
});


/**
 * <<< OUVINTE DE CLIQUE-DUPLO MODIFICADO: Agora trata de CRIAR anotações >>>
 */
modelViewer.addEventListener('dblclick', (event) => {
  console.log('--- Double Click Detected --- Annotation mode:', isAnnotationModeActive);

  // --- LÓGICA DE CRIAR ---
  // Só cria se o modo de anotação estiver ativo
  if (!isAnnotationModeActive) {
    console.log('Annotation mode OFF. Ignoring double click.');
    return;
  }

  console.log('Attempting CREATE via double click. Raycasting...');
  const positionAndNormal = modelViewer.positionAndNormalFromPoint(
    event.clientX,
    event.clientY
  );
  console.log('Raycast result:', positionAndNormal);

  // Se o raycast atingiu o modelo
  if (positionAndNormal) {
    // Mostra o modal para o utilizador inserir os dados
    showAnnotationModal({ position: positionAndNormal.position, normal: positionAndNormal.normal });
  } else {
    console.log('Raycast missed model.');
  }
});

// --- FIM DO CÓDIGO ---