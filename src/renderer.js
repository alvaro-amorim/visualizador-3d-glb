// C:\Users\Álvaro Amorim\app-3d-educativo\src\renderer.js
// Estrutura Base Final da Fase 1: Three.js com Anotações Sprite e UX Avançada

// --- 0.0. Importações de Módulos ---
import './index.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- 1.0. Referências aos Elementos do DOM (HTML) ---
const statusLog = document.querySelector('#status-log p');
const btnLoadFile = document.getElementById('btn-load-file');
const btnToggleAnnotation = document.getElementById('btn-toggle-annotation');
const btnSaveState = document.getElementById('btn-save-state');
const btnLoadState = document.getElementById('btn-load-state');
const canvasContainer = document.getElementById('threejs-canvas-container');

// Elementos do Modal de Anotação (para inserção de texto)
const modalBackdrop = document.getElementById('annotation-modal-backdrop');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalTitleInput = document.getElementById('annotation-title');
const modalTextInput = document.getElementById('annotation-text');


// --- 2.0. Variáveis de Estado Globais e Three.js ---

// Variáveis Principais do Three.js
let scene, camera, renderer, controls, loadedModel, pmremGenerator;
const rgbeLoader = new RGBELoader();
const gltfLoader = new GLTFLoader();

// Variáveis de Estado da Aplicação
let isAnnotationModeActive = false; // Controla se a criação/edição/remoção está ativa
let annotationSprites = [];       // Array para guardar os objetos THREE.Sprite
let currentAnnotationData = null; // Guarda dados temporários para criação/edição
let currentModelBlobUrl = null;   // Guarda o URL do Blob para gestão de memória

// Variáveis de Raycasting (para clique)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


// --- 3.0. Funções Auxiliares Comuns ---

/**
 * 3.1. Atualiza o texto na barra de status da aplicação.
 * @param {string} message - A mensagem a ser exibida.
 */
const updateStatus = (message) => {
  if (statusLog) {
    statusLog.textContent = message.startsWith('Status:') || message.startsWith('Erro:') ? message : `Status: ${message}`;
  } else {
    console.warn("Elemento statusLog não encontrado no DOM.");
  }
};

/**
 * 3.2. Função auxiliar para converter Buffer (do Electron) para ArrayBuffer (para loaders).
 * @param {Buffer} buf - O Buffer de entrada.
 * @returns {ArrayBuffer} - O ArrayBuffer resultante.
 */
function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}


// --- 4.0. Inicialização da Cena Three.js (Setup) ---

/**
 * 4.1. Configura a cena, câmara, renderer, controlos e inicia o loop principal.
 */
function initThreeJS() {
  console.log('4.1. Initializing Three.js scene...');
  try {
    // 4.1.1. Configuração da Cena e Câmara
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); 
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1.6, 5); 
    camera.lookAt(0, 0.8, 0);       

    // 4.1.2. Configuração do Renderer (Desenho)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.0; 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasContainer.appendChild(renderer.domElement); 

    // 4.1.3. Configuração do PMREM Generator e Controlos
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0); 
    controls.enableDamping = true;
    controls.dampingFactor = 0.15; 
    controls.rotateSpeed = 0.25; 
    
    // <<< CORREÇÃO: Mapeamento de Botões para Rotação e Panning >>>
    // A rotação deve ser no botão direito (2) para evitar conflito com o desenho
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.DOLLY,    // Usado para Dolly/Zoom (Mas o onWheel sobrepõe isso)
        MIDDLE: THREE.MOUSE.PAN,    // Botão do meio para Panning/Arrastar (UX clássica)
        RIGHT: THREE.MOUSE.ROTATE   // Botão Direito para Órbita/Girar
    };
    // <<< FIM DA CORREÇÃO >>>

    controls.screenSpacePanning = true; 
    controls.enableZoom = false; 
    controls.minDistance = 0.5;
    controls.maxDistance = 15;
    controls.update();

    // 4.1.4. Configuração das Luzes
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 4.1.5. Adiciona Listeners
    window.addEventListener('resize', onWindowResize); 
    renderer.domElement.addEventListener('click', onClick);      
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false }); 
    renderer.domElement.addEventListener('mousedown', onMouseDown, false); 
    window.addEventListener('mouseup', onMouseUp, false); 
    
    animate();
    updateStatus('Cena 3D inicializada. Carregue um modelo.');

  } catch(error) {
      console.error("!!! Erro fatal na inicialização do Three.js:", error);
      updateStatus("Erro: Falha ao inicializar a cena 3D.");
  }
}

// --- 5.0. Funções de Controlo e Visualização ---

/**
 * 5.1. Função do Loop de Renderização Principal (Game Loop).
 */
function animate() {
  if (!renderer) return;
  requestAnimationFrame(animate);
  controls.update(); 
  renderer.render(scene, camera);
}

/**
 * 5.2. Ajusta a câmara e o renderer quando a janela é redimensionada.
 */
function onWindowResize() {
  if (!camera || !renderer || !canvasContainer) return;
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}


// --- 6.0. Funções de Carregamento de Recursos ---

/**
 * 6.1. Carrega um modelo .glb selecionado pelo utilizador.
 */
const loadModelFromFile = async () => {
  console.log('6.1. loadModelFromFile called.');
  if (!scene || !gltfLoader || !window.electronAPI) {
      updateStatus("Erro: Cena 3D ou API não inicializada."); return;
  }
  try {
    updateStatus('A abrir janela de seleção...');
    const fileDataBuffer = await window.electronAPI.openFile();
    if (!fileDataBuffer) { updateStatus('Seleção cancelada.'); return; }
    updateStatus('Ficheiro recebido. A carregar modelo...');

    // Limpa cena anterior
    if (loadedModel) scene.remove(loadedModel);
    annotationSprites.forEach(sprite => scene.remove(sprite));
    annotationSprites = []; 

    // Tenta carregar o GLB a partir do Buffer
    gltfLoader.parse(toArrayBuffer(fileDataBuffer), '', (gltf) => {
      loadedModel = gltf.scene;
      console.log('GLB parsed successfully. Adding model to scene.');
      scene.add(loadedModel);
      updateStatus('Modelo carregado! A carregar ambiente...');
      loadEnvironment('/assets/environment.hdr'); // Carrega ambiente padrão
    }, (error) => {
      console.error('!!! Erro ao processar GLB:', error);
      updateStatus('Erro ao processar o ficheiro GLB.');
    });

  } catch (error) {
    console.error('!!! Erro interno em loadModelFromFile:', error);
    updateStatus(`Erro inesperado ao carregar ficheiro: ${error.message}`);
  }
};

/**
 * 6.2. Carrega e aplica um mapa de ambiente HDR.
 * @param {string} url - O caminho para o ficheiro .hdr.
 */
function loadEnvironment(url) {
  console.log('6.2. Loading environment map:', url);
  if (!scene || !pmremGenerator || !rgbeLoader) {
     updateStatus("Erro: Cena não pronta para carregar ambiente."); return;
  }
  rgbeLoader.load(url, (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    pmremGenerator.dispose();
    texture.dispose();
    scene.environment = envMap; 
    updateStatus('Modelo e ambiente carregados com sucesso!');
    console.log('Environment map applied.');
  }, undefined, (error) => {
    console.error(`!!! Erro ao carregar ambiente HDR de ${url}:`, error);
    updateStatus('Modelo carregado, mas erro ao carregar ambiente.');
  });
}


// --- 7.0. Funções de Gestão de Anotação (UI/Modal) ---

/**
 * 7.1. Ativa ou desativa o modo de anotação e controla a visibilidade dos sprites.
 */
const toggleAnnotations = () => {
  isAnnotationModeActive = !isAnnotationModeActive;
  console.log('7.1. Annotation mode toggled. New state:', isAnnotationModeActive);

  annotationSprites.forEach(sprite => {
      sprite.visible = isAnnotationModeActive;
  });

  updateStatus(isAnnotationModeActive ? 'Modo de Anotação ATIVADO. Clique DUPLO para texto, Clique ESQUERDO e arraste para desenhar.' : 'Modo de Anotação DESATIVADO.');
};

/**
 * 7.2. Mostra o modal HTML para inserir dados da anotação.
 * @param {object} data - Contém o ponto 3D: {point: THREE.Vector3} para criação.
 */
const showAnnotationModal = (data) => {
  console.log('7.2. Showing modal for creation/editing.');
  currentAnnotationData = data; // Guarda o ponto 3D
  
  // Limpa e configura o modal para criação (Modo Edição não implementado)
  modalTitleInput.value = '';
  modalTextInput.value = '';
  modalBackdrop.querySelector('h2').innerText = "Adicionar Anotação";
  
  modalBackdrop.classList.remove('modal-hidden');
  modalTitleInput.focus();
};

/**
 * 7.3. Esconde o modal HTML.
 */
const hideAnnotationModal = () => {
  currentAnnotationData = null;
  modalBackdrop.classList.add('modal-hidden');
};

/**
 * 7.4. Cria um Sprite do Three.js com texto e o adiciona à cena.
 * Esta função é chamada pelo botão 'Salvar' do modal.
 */
const saveAnnotation = () => {
  if (!currentAnnotationData || !currentAnnotationData.point) {
      console.warn("7.4. Save clicked but no 3D point data available.");
      hideAnnotationModal(); return;
  }
  const title = modalTitleInput.value.trim();
  const text = modalTextInput.value.trim();
  if (!title) { alert("Por favor, insira um título."); return; }

  // Cria o Sprite visual na cena
  createAnnotationSprite(currentAnnotationData.point, title, text);
  hideAnnotationModal();
};

/**
 * 7.5. <<< NOVA FUNÇÃO: Desfazer (Undo) a última anotação ou traço >>>
 */
const undoLastAnnotation = () => {
    if (annotationSprites.length === 0) {
        updateStatus("Não há anotações ou desenhos para desfazer.");
        return;
    }

    // Pega no último objeto do array
    const lastObject = annotationSprites[annotationSprites.length - 1];
    
    // Remove da cena
    scene.remove(lastObject);
    
    // Remove do array de gestão (pop)
    annotationSprites.pop();
    
    // Limpeza de memória (essencial para Three.js)
    if (lastObject.geometry) lastObject.geometry.dispose();
    if (lastObject.material) lastObject.material.dispose();
    if (lastObject.material.map) lastObject.material.map.dispose();

    updateStatus(`Desfeito: Última anotação/desenho removida.`);
    console.log('Undo successful. Total annotations remaining:', annotationSprites.length);
};

// --- 8.0. Funções de Renderização e Criação de Sprite ---

/**
 * 8.1. Cria um Sprite do Three.js com texto e o adiciona à cena.
 * @param {THREE.Vector3} position - A posição 3D onde colocar o sprite.
 * @param {string} title - O título da anotação.
 * @param {string} text - O texto da anotação.
 */
function createAnnotationSprite(position, title, text) {
  console.log(`8.1. Creating sprite at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}.`);
   if (!scene) { updateStatus("Erro: Cena não inicializada."); return; }

  // 8.1.1. Configuração e Desenho do Canvas (Textura)
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 16;
  const padding = 10;
  context.font = `bold ${fontSize}px Arial`;
  const titleWidth = context.measureText(title).width;
  context.font = `${fontSize}px Arial`;
  const textLines = text.split('\n');
  let textWidth = 0;
  textLines.forEach(line => { textWidth = Math.max(textWidth, context.measureText(line).width); });
  const maxWidth = Math.max(titleWidth, textWidth);
  const lineSpacing = 5;
  const canvasWidth = maxWidth + padding * 2;
  const canvasHeight = fontSize * (1 + textLines.length) + padding * 2 + (lineSpacing * textLines.length);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  context.fillStyle = 'rgba(0, 0, 0, 0.75)';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = 'white';
  context.font = `bold ${fontSize}px Arial`;
  context.fillText(title, padding, padding + fontSize);
  context.font = `${fontSize}px Arial`;
  let yPos = padding + fontSize * 2 + lineSpacing;
  textLines.forEach(line => { context.fillText(line, padding, yPos); yPos += fontSize + lineSpacing; });

  // 8.1.2. Criação do Objeto Sprite
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    sizeAttenuation: true, // Sprite diminui/aumenta com o zoom (Comportamento 3D correto)
    // <<< CORREÇÃO DE PROFUNDIDADE >>>
    depthTest: false, // DESLIGA o teste de profundidade (Sprite sempre visível, não fica "dentro" do corpo)
    renderOrder: 100 // Garante que é desenhado DEPOIS dos outros objetos da cena
    // <<< FIM DA CORREÇÃO >>>
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);

  // 8.1.3. Define Escala (em Unidades do Mundo 3D)
  const worldScaleBase = 0.2; 
  sprite.scale.set(worldScaleBase, worldScaleBase * (canvasHeight / canvasWidth), 1.0);

  // 8.1.4. Guarda dados e adiciona à cena
  sprite.userData = { 
      isAnnotation: true, // Identificador
      title: title, 
      text: text,
      position: position
  };
  scene.add(sprite);
  annotationSprites.push(sprite);
  updateStatus(`Anotação "${title}" criada!`);
}

// --- 9.0. Funções de Salvar/Carregar Estado (TODO: Reimplementar) ---
// Estas funções serão implementadas para a gestão do estado 3D.

const saveState = () => {
    // 9.1. TODO: Implementar salvamento dos sprites (posição, texto) e estado da câmara/controlo.
    console.log("9.1. Save state needs reimplementation for Three.js.");
    updateStatus('Funcionalidade Salvar Estado precisa ser implementada.');
};
const loadState = () => {
    // 9.2. TODO: Implementar carregamento dos sprites e estado da câmara/controlo.
    console.log("9.2. Load state needs reimplementation for Three.js.");
    updateStatus('Funcionalidade Carregar Estado precisa ser implementada.');
};


// --- 10.0. Ouvintes de Eventos do Canvas (Interação 3D) ---

// 10.0.1. Variáveis de estado do Desenho Livre
let isDrawing = false;      // Flag que indica se o rato está a ser arrastado
let currentDrawingLine = null; // O objeto THREE.Line atual a ser desenhado
let drawingPoints = [];     // Array para guardar os pontos 3D da linha atual
let drawingPlane = null;    // Plano virtual para traçado no ar
let lastIntersectionDistance = 5; // Distância do último ponto traçado ao modelo

// 10.0.2. Lógica para traçar a linha em tempo real
function onMouseMove(event) {
    if (!isDrawing) return; 

    // 1. Calcular coordenadas normalizadas do rato
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 2. Traçar no Modelo (Prioritário)
    const modelIntersects = loadedModel ? raycaster.intersectObject(loadedModel, true) : [];

    let intersectionPoint = null;

    if (modelIntersects.length > 0) {
        // Opção A: Clicou no Modelo (Traçado na Superfície)
        const intersection = modelIntersects[0];
        intersectionPoint = intersection.point;
        
        lastIntersectionDistance = intersection.distance;

        if (drawingPlane) {
            drawingPlane.position.copy(intersectionPoint);
            drawingPlane.lookAt(camera.position); 
        }

    } else {
        // Opção B: Clicou no Ar (Traçado no Plano Virtual)
        
        if (!drawingPlane) return; 
        const planeIntersects = raycaster.intersectObjects([drawingPlane]); 
        
        if (planeIntersects.length > 0) {
            intersectionPoint = planeIntersects[0].point;
        }
    }

    // 3. Se um ponto válido foi encontrado, processa o traçado
    if (intersectionPoint) {
        
        if (drawingPoints.length > 0) {
            const lastPoint = drawingPoints[drawingPoints.length - 1];
            if (lastPoint.distanceTo(intersectionPoint) < 0.005) return; 
        }

        // 4. Adiciona o ponto e atualiza a geometria da linha
        drawingPoints.push(intersectionPoint.clone());
        
        if (currentDrawingLine) {
            const positions = new Float32Array(drawingPoints.length * 3);
            for (let i = 0; i < drawingPoints.length; i++) {
                positions[i * 3] = drawingPoints[i].x;
                positions[i * 3 + 1] = drawingPoints[i].y;
                positions[i * 3 + 2] = drawingPoints[i].z;
            }
            currentDrawingLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            currentDrawingLine.geometry.attributes.position.needsUpdate = true;
            currentDrawingLine.geometry.setDrawRange(0, drawingPoints.length);
        }
    }
}

// 10.0.3. Iniciar o Desenho (Mouse Down)
function onMouseDown(event) {
    // 1. Verifica se o modo de anotação está ativo e se o clique foi no botão esquerdo (0)
    // O desenho livre está no botão esquerdo
    if (!isAnnotationModeActive || event.button !== 0) return;

    // 2. Configura Raycaster na posição do rato
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const modelIntersects = loadedModel ? raycaster.intersectObject(loadedModel, true) : [];

    // 3. Verifica se tem um desenho em curso para continuar
    if (currentDrawingLine) {
         console.log('10.0.3. Desenho Livre continuado.');
         isDrawing = true;
    } 
    // <<< CORREÇÃO: Inicia o desenho SEMPRE que o modo estiver ativo >>>
    else if (isAnnotationModeActive) {
        console.log('10.0.3. Novo Desenho Livre iniciado (Qualquer lugar).');
        isDrawing = true;
        drawingPoints = []; 
        
        // 4. Cria o objeto THREE.Line inicial
        const material = new THREE.LineBasicMaterial({ 
            color: 0xff0000, 
            linewidth: 5, 
            depthTest: false 
        }); 
        const geometry = new THREE.BufferGeometry();
        geometry.setDrawRange(0, 0); 
        currentDrawingLine = new THREE.Line(geometry, material);
        currentDrawingLine.userData = { isAnnotation: true, title: "Desenho Livre" };
        scene.add(currentDrawingLine);
        
        // 5. Cria/Atualiza o Plano Virtual de Traçado
        
        let initialPoint;
        if (modelIntersects.length > 0) {
            // Se acertou no modelo, usa o ponto de interseção
            initialPoint = modelIntersects[0].point.clone();
            lastIntersectionDistance = modelIntersects[0].distance;
        } else {
            // Se não acertou no modelo, projeta o ponto do cursor na profundidade conhecida
            const projectedVector = new THREE.Vector3(mouse.x, mouse.y, 0.5); 
            projectedVector.unproject(camera); 
            
            const direction = new THREE.Vector3().subVectors(projectedVector, camera.position).normalize();
            initialPoint = camera.position.clone().add(direction.multiplyScalar(lastIntersectionDistance));
        }


        if (!drawingPlane) {
            const planeGeometry = new THREE.PlaneGeometry(50, 50); 
            const planeMaterial = new THREE.MeshBasicMaterial({ visible: false }); 
            drawingPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            scene.add(drawingPlane);
        }
        
        drawingPlane.position.copy(initialPoint);
        drawingPlane.lookAt(camera.position); 
        
        // 6. Adiciona o ponto inicial à linha
        drawingPoints.push(initialPoint.clone());

        // 7. Adiciona o ouvinte de MouseMove e desativa os OrbitControls
        renderer.domElement.addEventListener('mousemove', onMouseMove, false);
        controls.enabled = false;
    }
}

// 10.0.4. Finalizar o Desenho (Mouse Up)
function onMouseUp(event) {
    if (!isDrawing) return;

    console.log('10.0.4. Desenho Livre finalizado. Total de pontos:', drawingPoints.length);
    isDrawing = false;
    
    renderer.domElement.removeEventListener('mousemove', onMouseMove, false);
    
    // Reativa os OrbitControls
    controls.enabled = true;

    // Limpa o Plano Virtual (pois o traçado terminou)
    if (drawingPlane) {
        scene.remove(drawingPlane);
        drawingPlane = null;
    }

    // Se a linha for válida, adiciona-a ao array de gestão
    if (drawingPoints.length > 1) {
        annotationSprites.push(currentDrawingLine); 
        updateStatus(`Desenho Livre concluído com ${drawingPoints.length} pontos.`);
    } else if (currentDrawingLine) {
        // Linha muito curta, remove-a e o seu material/geometria
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine.material.dispose();
        currentDrawingLine = null;
        updateStatus('Desenho muito curto removido.'); // Mantemos a mensagem
    }
    
    currentDrawingLine = null; // Limpa a linha atual
}


/**
 * 10.1. Função chamada no evento de clique simples no canvas.
 * Responsável por Menu de Ação/Apagar Anotações ou Mover o Foco (Target-on-Click).
 */
function onClick(event) {
    // Se o OrbitControls estiver desativado, o clique deve ser ignorado.
    if (controls.enabled === false) return; 
    
    console.log('10.1. Single Click Detected.');

    // 10.1.1. Lógica de Raycasting
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 10.1.2. Lógica de AÇÃO NA ANOTAÇÃO (Menu de Contexto/Apagar)
    // Foi movida para onContextMenu (botão direito)
    
    // 10.1.3. Lógica de MOVER FOCO (Target-on-Click)
    if (loadedModel) {
        const intersects = raycaster.intersectObject(loadedModel, true);

        if (intersects.length > 0) {
            const newTarget = intersects[0].point;
            controls.target.copy(newTarget);
            controls.update();
            updateStatus(`Foco da câmara movido para o ponto clicado.`);
        }
    }
}


/**
 * 10.2. Função chamada no evento de clique duplo no canvas.
 * Responsável por iniciar a criação de anotações DE TEXTO.
 */
function onDoubleClick(event) {
  console.log('10.2. Double Click Detected. Mode:', isAnnotationModeActive);
  if (!isAnnotationModeActive || !loadedModel || !camera || !renderer) return;

  console.log('Attempting CREATE TEXT via double click. Raycasting model...');
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(loadedModel, true);

  if (intersects.length > 0) {
    const intersectionPoint = intersects[0].point;
    
    controls.target.copy(intersectionPoint);
    controls.update();

    console.log('Intersection point on model:', intersectionPoint);
    showAnnotationModal({ point: intersectionPoint }); // Chama o modal de TEXTO
  } else {
    console.log('Raycast missed model.');
    updateStatus('Clique duplo não atingiu o modelo.');
  }
}

/**
 * 10.3. Função chamada no evento de roda do rato (wheel).
 * Responsável pelo Zoom Direcional (Zoom-to-Mouse).
 */
function onWheel(event) {
    event.preventDefault(); 
    const delta = event.deltaY > 0 ? 1 : -1; 
    const zoomSpeed = 0.15; 

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    let focusPoint = controls.target.clone();
    
    if (loadedModel) {
        const intersects = raycaster.intersectObject(loadedModel, true);
        if (intersects.length > 0) {
            focusPoint = intersects[0].point; 
        }
    }

    const vector = new THREE.Vector3();
    camera.getWorldDirection(vector); 
    vector.multiplyScalar(delta * zoomSpeed); 

    controls.target.sub(vector);
    camera.position.sub(vector);

    controls.update();
}

/**
 * 10.4. Menu de Contexto (Botão Direito) para Apagar/Editar
 */
function onContextMenu(event) {
    event.preventDefault(); // Impede o menu de contexto padrão do navegador

    console.log('10.4. Context Menu (Right Click) Detected.');
    if (!isAnnotationModeActive || annotationSprites.length === 0) return;

    // 1. Configura Raycaster na posição do rato
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 2. Verifica interseções com TODOS os objetos de anotação
    const intersects = raycaster.intersectObjects(annotationSprites);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        if (clickedObject.userData.isAnnotation || clickedObject.type === 'Line') {
            const title = clickedObject.userData.title || "Desenho Livre";
            const action = prompt(`Ação para "${title}"\n\nDigite:\n1: Editar (Não implementado)\n2: Apagar\n\n(Cancele ou feche para sair)`, "2");

            if (action === '2') {
                scene.remove(clickedObject);
                annotationSprites = annotationSprites.filter(obj => obj !== clickedObject);
                // Limpeza de memória
                if (clickedObject.geometry) clickedObject.geometry.dispose();
                if (clickedObject.material) clickedObject.material.dispose();
                if (clickedObject.material.map) clickedObject.material.map.dispose();
                updateStatus(`Anotação/Desenho "${title}" removida.`);
            } else if (action === '1') {
                 updateStatus(`Edição da anotação "${title}" solicitada. Funcionalidade a ser implementada.`);
            }
            return; // Finaliza o contexto
        }
    }
}

// --- 11.0. Adicionar "Ouvintes" de Eventos (Ligações de Botões) ---

// 11.0.1. Nota: Adicionar referência ao novo botão aqui
const btnUndo = document.getElementById('btn-undo'); 

console.log('11.0. Attaching event listeners to buttons...');

// Botão Carregar Ficheiro
if (btnLoadFile) {
    console.log('11.1. Attaching listener to btnLoadFile.');
    btnLoadFile.addEventListener('click', loadModelFromFile);
} else {
    console.error('!!! Erro 11.1: btnLoadFile not found in the DOM.');
}

// Botão Ativar Anotação
if (btnToggleAnnotation) {
    console.log('11.2. Attaching listener to btnToggleAnnotation.');
    btnToggleAnnotation.addEventListener('click', toggleAnnotations);
} else {
    console.error('!!! Erro 11.2: btnToggleAnnotation not found.');
}

// Botões Salvar/Carregar Estado (Temporariamente Desativados)
if (btnSaveState) {
    console.log('11.3. Attaching listener to btnSaveState (Desativado).');
    btnSaveState.addEventListener('click', saveState);
} else {
    console.error('!!! Erro 11.3: btnSaveState not found.');
}

if (btnLoadState) {
    console.log('11.4. Attaching listener to btnLoadState (Desativado).');
    btnLoadState.addEventListener('click', loadState);
} else {
    console.error('!!! Erro 11.4: btnLoadState not found.');
}

// <<< NOVO: Botão Desfazer (Undo) >>>
if (btnUndo) {
    console.log('11.5. Attaching listener to btnUndo.');
    btnUndo.addEventListener('click', undoLastAnnotation);
} else {
    console.warn('!!! Aviso 11.5: btnUndo not found (Adicione ao HTML).');
}
// <<< FIM DO NOVO BOTÃO >>>

// Botões do Modal
if (modalBtnSave) {
    console.log('11.6. Attaching listener to modalBtnSave.');
    modalBtnSave.addEventListener('click', saveAnnotation);
} else {
    console.error('!!! Erro 11.6: modalBtnSave not found.');
}

if (modalBtnCancel) {
    console.log('11.7. Attaching listener to modalBtnCancel.');
    modalBtnCancel.addEventListener('click', hideAnnotationModal);
} else {
    console.error('!!! Erro 11.7: modalBtnCancel not found.');
}

console.log('11.8. Button listeners attached.');


// --- 12.0. Inicialização Final da Aplicação ---
// Chama a função principal de inicialização
initThreeJS();