// --- 0.0. Importações de Módulos ---
import './index.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// <<< NOVAS IMPORTAÇÕES PARA LINHAS GROSSAS (Three.js Addons) >>>
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
// <<< FIM DAS NOVAS IMPORTAÇÕES >>>
import 'three/examples/jsm/lines/LineSegmentsGeometry.js'; // Adiciona o loader de segmentos

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
let isAnnotationModeActive = false; // Flag: modo de anotação ativo/inativo
let isEraserModeActive = false;     // <<< NOVO: Flag para o modo borracha >>>
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
    
    // <<< CORREÇÃO DE LINHA GROSSA: Inicialização do LineMaterial >>>
    // Esta linha CRUCIAL força o LineMaterial a inicializar-se com o renderer.
    // Sem esta inicialização, o LineMaterial não renderiza nada.
    const materialPlaceholder = new LineMaterial({ 
        linewidth: 0.001, 
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight) 
    });
    // Opcional: Adicionar e remover para garantir que o renderer o conhece
    const linePlaceholder = new Line2(new LineGeometry(), materialPlaceholder);
    scene.add(linePlaceholder);
    scene.remove(linePlaceholder);
    // <<< FIM DA CORREÇÃO >>>


    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0); 
    controls.enableDamping = true;
    controls.dampingFactor = 0.15; 
    controls.rotateSpeed = 0.25; 
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.DOLLY,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE
    };
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
    
    // Inicia o loop de renderização
    animate();
    
    // <<< CORREÇÃO: Configuração inicial da resolução da linha >>>
    // Garante que o material da linha (LineMaterial) tem a resolução inicial
    updateLineResolution(canvasContainer.clientWidth, canvasContainer.clientHeight);
    
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
  
  // <<< CORREÇÃO: Atualiza a resolução do material da linha após redimensionar >>>
  updateLineResolution(width, height);
}

/**
 * 5.3. Funções para garantir que os materiais da linha grossa renderizam corretamente.
 * @param {number} width - Largura do viewport.
 * @param {number} height - Altura do viewport.
 */
function updateLineResolution(width, height) {
    if (!renderer) return;
    
    // Itera sobre todos os objetos na cena
    scene.traverse(function (object) {
        // Verifica se o objeto é uma linha THREE.Line2
        if (object.isLine2) {
            // A LineMaterial precisa da resolução do ecrã
            object.material.resolution.set(width, height);
        }
    });
}
// --- 6.0. Funções de Carregamento de Recursos ---

/**
 * 6.1. Carrega um modelo .glb selecionado pelo utilizador.
 */
const loadModelFromFile = async () => {
  // <<< DIAGNÓSTICO: Log no início da função >>>
  console.log('6.1. loadModelFromFile called.');
  // <<< FIM DO DIAGNÓSTICO >>>
  
  if (!scene || !gltfLoader || !window.electronAPI) {
      updateStatus("Erro: Cena 3D ou API não inicializada."); return;
  }
  try {
    updateStatus('A abrir janela de seleção...');
    console.log('Calling window.electronAPI.openFile()...');
    const fileDataBuffer = await window.electronAPI.openFile();
    if (!fileDataBuffer) { updateStatus('Seleção cancelada.'); return; }
    updateStatus('Ficheiro recebido. A carregar modelo...');

    // Limpa cena anterior
    if (loadedModel) scene.remove(loadedModel);
    annotationSprites.forEach(sprite => disposeObjectAndChildren(sprite)); // Limpeza robusta
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

// 7.0.1. Reintroduzir referências aos novos elementos de UI
const drawToolsPanel = document.getElementById('drawing-tools');
const drawColorInput = document.getElementById('draw-color');

/**
 * Funções Auxiliares de Limpeza (Dispose)
 * Limpa a memória da GPU usada pelo objeto e todos os seus filhos recursivamente.
 * @param {THREE.Object3D} object - O objeto Three.js a ser limpo.
 */
function disposeObjectAndChildren(object) {
    if (!object) return;

    // 1. Remove o objeto principal da cena primeiro
    scene.remove(object); 

    // 2. Itera sobre o objeto e seus filhos recursivamente para limpar recursos
    object.traverse(function (child) {
        // Verifica se é um objeto que usa geometria/material (Mesh, Line, Sprite)
        if (child.isMesh || child.isLine || child.isSprite) { 
            // Limpa Geometria
            if (child.geometry) child.geometry.dispose();

            // Limpa Material(is)
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach(material => {
                    // Limpa Texturas
                    if (material.map) material.map.dispose();
                    // Limpa o material
                    material.dispose();
                });
            }
        }
    });
}


/**
 * 7.1. Ativa ou desativa o modo de anotação e controla a visibilidade dos sprites.
 */
const toggleAnnotations = () => {
  // Desativa a Borracha se for ativada
  if (!isAnnotationModeActive && isEraserModeActive) {
      isEraserModeActive = false;
      // Não precisa esconder as ferramentas aqui, pois toggleEraserMode já fará
  }

  isAnnotationModeActive = !isAnnotationModeActive;
  console.log('7.1. Annotation mode toggled. New state:', isAnnotationModeActive);

  annotationSprites.forEach(sprite => {
      sprite.visible = isAnnotationModeActive;
  });

  if (isAnnotationModeActive) {
      if (drawToolsPanel) drawToolsPanel.style.display = 'block';
      updateStatus('Modo de Anotação ATIVADO. Desenhe com o botão esquerdo. Rotação: direito.');
  } else {
      if (drawToolsPanel) drawToolsPanel.style.display = 'none';
      updateStatus('Modo de Anotação DESATIVADO.');
  }
};

/**
 * 7.2. Mostra o modal HTML para inserir dados da anotação.
 * @param {object} data - Contém o ponto 3D: {point: THREE.Vector3} para criação.
 */
const showAnnotationModal = (data) => {
  console.log('7.2. Showing modal for creation/editing.');
  currentAnnotationData = data; 
  
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
 * 7.5. FUNÇÃO UNDO CORRIGIDA E ROBUSTA.
 * Desfazer (Undo) a última anotação ou traço.
 */
const undoLastAnnotation = () => {
    if (annotationSprites.length === 0) {
        updateStatus("Não há anotações ou desenhos para desfazer.");
        return;
    }

    // 1. Pega e remove o último objeto do array de gestão
    const lastObject = annotationSprites.pop(); 
    
    // 2. Limpeza profunda e remoção da cena
    disposeObjectAndChildren(lastObject);
    
    updateStatus(`Desfeito: Última anotação/desenho removida.`);
    console.log('Undo successful. Total annotations remaining:', annotationSprites.length);
};

/**
 * 7.6. NOVA FUNÇÃO: Ativa/Desativa o modo Borracha
 */
const toggleEraserMode = () => {
    // Desativa o modo de anotação se a borracha for ativada
    if (!isEraserModeActive && isAnnotationModeActive) {
        isAnnotationModeActive = false; 
        annotationSprites.forEach(sprite => { sprite.visible = false; });
        if (drawToolsPanel) drawToolsPanel.style.display = 'none'; // Esconde ferramentas de desenho
    }

    isEraserModeActive = !isEraserModeActive;
    console.log('Eraser mode toggled. New state:', isEraserModeActive);

    if (isEraserModeActive) {
        updateStatus('Modo BORRACHA ATIVADO. Clique com o botão esquerdo para apagar.');
    } else {
        updateStatus('Modo BORRACHA DESATIVADO.');
    }
};

// --- 8.0. Funções de Renderização e Criação de Sprite ---

/**
 * 8.1. Cria um Sprite do Three.js com texto e o adiciona à cena.
 * @param {THREE.Vector3} position - A posição 3D onde colocar o sprite.
 * @param {string} title - O título da anotação.
 * @param {string} text - O texto da anotação.
 */
function createAnnotationSprite(position, title, text) {
  // ... (código que cria o Sprite e o adiciona à cena/annotationSprites) ...
}

/**
 * 8.2. <<< NOVA FUNÇÃO: Recria um Traço Livre (Cilindros) a partir de um array de pontos >>>
 * Esta função é crucial para o carregamento do estado.
 * @param {Array<number>} positionsArray - O array [x1, y1, z1, x2, y2, z2, ...]
 * @param {string} color - Cor hexadecimal.
 */
function recreateDrawingLine(positionsArray, color) {
    if (positionsArray.length < 6) return null; // Precisa de pelo menos 2 pontos (6 valores)

    // 1. Cria o objeto THREE.Group raiz
    const lineGroup = new THREE.Group();
    lineGroup.userData = { isAnnotation: true, title: "Desenho Livre", type: "LineGroup", color: color };
    
    const radius = 0.005; // Raio fixo
    
    // 2. Itera sobre os pontos para recriar os cilindros
    for (let i = 0; i < positionsArray.length - 3; i += 3) {
        const startPoint = new THREE.Vector3(positionsArray[i], positionsArray[i + 1], positionsArray[i + 2]);
        const endPoint = new THREE.Vector3(positionsArray[i + 3], positionsArray[i + 4], positionsArray[i + 5]);
        
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
        const length = direction.length();
        
        if (length < 0.001) continue; // Ignora se os pontos forem muito próximos

        // 3. Cria o cilindro
        const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 8);
        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: color, depthTest: false });
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

        // 4. Posiciona e orienta
        cylinder.position.copy(startPoint).lerp(endPoint, 0.5); 
        cylinder.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
        
        lineGroup.add(cylinder);
    }

    // Adiciona o grupo recriado à cena e ao array de gestão
    scene.add(lineGroup);
    annotationSprites.push(lineGroup);

    return lineGroup;
}


// --- 9.0. Funções de Salvar/Carregar Estado (Implementação) ---

/**
 * 9.1. Salva o estado atual (câmara + anotações) no localStorage.
 */
const saveState = () => {
    console.log('9.1. Saving state...');
    try {
        // 1. Coletar estado da câmara (posição e foco)
        const cameraState = {
            position: camera.position.toArray(),
            target: controls.target.toArray(),
            fov: camera.fov,
        };
        
        // 2. Coletar dados de todas as anotações/desenhos
        const annotationsData = [];
        
        annotationSprites.forEach(obj => {
            if (obj.userData.type === "LineGroup") {
                // <<< DESENHO LIVRE (THREE.Group de Cilindros) >>>
                
                const segments = [];
                const color = obj.userData.color;
                
                // Itera sobre todos os cilindros no grupo
                obj.traverse(child => {
                    if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
                        // Não podemos extrair as posições originais diretamente,
                        // mas podemos guardar a matriz de posição e rotação do cilindro.
                        // Para simplificar a recriação, salvamos a matriz.
                        segments.push({
                            matrix: child.matrix.toArray(), // Matriz de transformação
                            length: child.geometry.parameters.height, // Comprimento
                            color: color
                        });
                    }
                });

                if (segments.length > 0) {
                    annotationsData.push({
                        type: "Drawing",
                        segments: segments,
                        title: obj.userData.title,
                    });
                }
                
            } else if (obj.isSprite) {
                // Anotação de Texto (THREE.Sprite)
                annotationsData.push({
                    type: "Sprite",
                    position: obj.position.toArray(),
                    title: obj.userData.title,
                    text: obj.userData.text,
                });
            }
        });
        
        const fullState = {
            camera: cameraState,
            annotations: annotationsData,
        };

        localStorage.setItem('threejs_app_state', JSON.stringify(fullState));
        updateStatus('Estado (Câmara + Anotações + Desenhos) salvo!');
        console.log('State saved successfully.');

    } catch (error) {
        console.error('!!! Error inside saveState:', error);
        updateStatus(`Erro ao salvar: ${error.message}`);
    }
};

/**
 * 9.2. Carrega o estado salvo a partir do localStorage.
 */
const loadState = () => {
    console.log('9.2. Loading state...');
    try {
        const savedStateJSON = localStorage.getItem('threejs_app_state');
        if (!savedStateJSON) {
            updateStatus('Nenhum estado salvo encontrado.');
            return;
        }
        
        const savedState = JSON.parse(savedStateJSON);

        // 1. Limpa todas as anotações existentes antes de carregar
        while (annotationSprites.length > 0) {
            disposeObjectAndChildren(annotationSprites.pop());
        }

        // 2. Carregar a Câmara
        if (savedState.camera) {
            const cam = savedState.camera;
            camera.position.fromArray(cam.position);
            controls.target.fromArray(cam.target);
            camera.fov = cam.fov;
            camera.updateProjectionMatrix();
            controls.update();
        }

        // 3. Carregar Anotações e Desenhos
        if (savedState.annotations && Array.isArray(savedState.annotations)) {
            savedState.annotations.forEach(data => {
                if (data.type === "Sprite") {
                    // Recriação de Texto
                    const pos = new THREE.Vector3().fromArray(data.position);
                    createAnnotationSprite(pos, data.title, data.text); 
                    
                } else if (data.type === "Drawing") {
                    // <<< RECRIACÃO DE DESENHO LIVRE >>>
                    
                    const lineGroup = new THREE.Group();
                    lineGroup.userData = { isAnnotation: true, type: "LineGroup", title: data.title };

                    // Recria a geometria do cilindro para cada segmento
                    data.segments.forEach(segment => {
                        const radius = 0.005; 
                        const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, segment.length, 8);
                        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: segment.color, depthTest: false });
                        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

                        // Aplica a matriz de transformação salva (posição e rotação)
                        cylinder.matrix.fromArray(segment.matrix);
                        cylinder.matrix.decompose(cylinder.position, cylinder.rotation, cylinder.scale); 
                        
                        lineGroup.add(cylinder);
                        // Limpa a geometria e material do segmento após o uso
                        cylinderGeometry.dispose();
                        cylinderMaterial.dispose();
                    });
                    
                    // Adiciona o grupo recriado à cena e ao array de gestão
                    scene.add(lineGroup);
                    annotationSprites.push(lineGroup);
                }
            });
        }
        
        updateStatus('Estado (Câmara + Anotações + Desenhos) carregado com sucesso!');

    } catch (error) {
        console.error('!!! Erro inside loadState:', error);
        updateStatus(`Erro ao carregar estado: ${error.message}. Verifique a consola.`);
    }
};


// --- 10.0. Ouvintes de Eventos do Canvas (Interação 3D) ---

// 10.0.1. Variáveis de estado do Desenho Livre
let isDrawing = false;      // Flag que indica se o rato está a ser arrastado
let currentDrawingLine = null; // O objeto THREE.Group atual a ser desenhado
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
        if (drawingPoints.length > 0 && currentDrawingLine) {
            const startPoint = drawingPoints[drawingPoints.length - 1].clone();
            const endPoint = intersectionPoint.clone();

            const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
            const length = direction.length();
            
            if (length > 0.001) { 
                const selectedColor = drawColorInput ? drawColorInput.value : '#FF0000';
                const radius = 0.005; 

                const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 8);
                const cylinderMaterial = new THREE.MeshBasicMaterial({ color: selectedColor, depthTest: false });
                const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

                cylinder.position.copy(startPoint).lerp(endPoint, 0.5); 
                cylinder.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
                
                currentDrawingLine.add(cylinder);
            }
        }
        // Adiciona o novo ponto à lista
        drawingPoints.push(intersectionPoint.clone());
    }
}

// 10.0.3. Iniciar o Desenho (Mouse Down)
function onMouseDown(event) {
    // 1. Verifica se o modo de anotação está ativo E SE NÃO ESTAMOS NA BORRACHA
    if (!isAnnotationModeActive || event.button !== 0 || isEraserModeActive) return;

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
    // Se for um novo desenho, inicia se o modo estiver ativo
    else if (isAnnotationModeActive) {
        console.log('10.0.3. Novo Desenho Livre iniciado.');
        isDrawing = true;
        drawingPoints = []; 
        
        // 4. Cria o objeto THREE.Group inicial (Novo Traço)
        const selectedColor = drawColorInput ? drawColorInput.value : '#FF0000';

        currentDrawingLine = new THREE.Group(); 
        currentDrawingLine.userData = { 
            isAnnotation: true, 
            title: "Desenho Livre",
            type: "LineGroup", // Identificador de tipo
            color: selectedColor
        };
        scene.add(currentDrawingLine);
        
        // 5. Cria/Atualiza o Plano Virtual de Traçado
        let initialPoint;
        if (modelIntersects.length > 0) {
            initialPoint = modelIntersects[0].point.clone();
            lastIntersectionDistance = modelIntersects[0].distance;
        } else {
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
        if (currentDrawingLine && currentDrawingLine.children.length > 0) {
            annotationSprites.push(currentDrawingLine); 
            updateStatus(`Desenho Livre concluído com ${currentDrawingLine.children.length} segmentos.`);
        } else {
             // Limpeza se o desenho foi iniciado mas não houve traço
             scene.remove(currentDrawingLine);
             currentDrawingLine.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) object.material.dispose();
            });
            updateStatus('Desenho muito curto removido.');
        }
    } else if (currentDrawingLine) {
        // Linha muito curta, remove o grupo
        scene.remove(currentDrawingLine);
        currentDrawingLine.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        updateStatus('Desenho muito curto removido.'); 
    }
    
    currentDrawingLine = null; // Limpa o objeto de traçado atual
}


/**
 * 10.1. Função chamada no evento de clique simples no canvas.
 * Responsável por Remoção (Borracha) ou Mover o Foco (Target-on-Click).
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
    const intersects = raycaster.intersectObjects(annotationSprites, true); // Raycast em anotações

    // 10.1.2. Lógica de BORRACHA (Prioridade Máxima)
    if (isEraserModeActive && annotationSprites.length > 0) {
        if (intersects.length > 0) {
            // Encontra o objeto raiz (Grupo ou Sprite)
            let clickedObject = intersects[0].object;
            while (clickedObject.parent && clickedObject.parent !== scene) {
                if (clickedObject.parent.userData.isAnnotation) {
                    clickedObject = clickedObject.parent;
                    break;
                }
                clickedObject = clickedObject.parent;
            }

            if (clickedObject.userData && clickedObject.userData.isAnnotation) {
                const title = clickedObject.userData.title || "Desenho Livre";
                
                // Remove o objeto com limpeza de memória (idêntica à do Undo)
                disposeObjectAndChildren(clickedObject);
                annotationSprites = annotationSprites.filter(obj => obj !== clickedObject);
                updateStatus(`BORRACHA: Objeto "${title}" apagado.`);
                event.stopPropagation(); 
                return; 
            }
        }
    }
    // FIM DA LÓGICA DE BORRACHA (Se a borracha falhou ou não estava ativa, continua)

    // 10.1.3. Lógica de MOVER FOCO (Target-on-Click)
    if (loadedModel) {
        const modelIntersects = raycaster.intersectObject(loadedModel, true);

        if (modelIntersects.length > 0) {
            const newTarget = modelIntersects[0].point;
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
    const intersects = raycaster.intersectObjects(annotationSprites, true);

    if (intersects.length > 0) {
        // Encontra o objeto principal (o THREE.Group ou Sprite)
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && clickedObject.parent !== scene) {
            if (clickedObject.parent.userData.isAnnotation) {
                clickedObject = clickedObject.parent;
                break;
            }
            clickedObject = clickedObject.parent;
        }

        if (clickedObject.userData && clickedObject.userData.isAnnotation) {
            const title = clickedObject.userData.title || "Desenho Livre";
            const action = prompt(`Ação para "${title}"\n\nDigite:\n1: Editar (Não implementado)\n2: Apagar\n\n(Cancele ou feche para sair)`, "2");

            if (action === '2') {
                // LÓGICA DE APAGAR O GRUPO USANDO FUNÇÃO AUXILIAR
                disposeObjectAndChildren(clickedObject);
                annotationSprites = annotationSprites.filter(obj => obj !== clickedObject);
                updateStatus(`Anotação/Desenho "${title}" removida.`);
            } else if (action === '1') {
                 updateStatus(`Edição da anotação "${title}" solicitada. Funcionalidade a ser implementada.`);
            }
            return; // Finaliza o contexto
        }
    }
}


// --- 11.0. Adicionar "Ouvintes" de Eventos (Ligações de Botões) ---

// 11.0.1. Nota: O elemento btnUndo é referenciado no topo (Secção 1.0)

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

// Botão UNDO (Desfazer)
const btnUndo = document.getElementById('btn-undo'); // Garante que a referência é local
if (btnUndo) {
    console.log('11.3. Attaching listener to btnUndo (UNDO FUNCTION).');
    btnUndo.addEventListener('click', undoLastAnnotation);
} else {
    console.error('!!! Erro 11.3: btnUndo not found in the DOM.');
}


// Botão BORRACHA
const btnEraser = document.getElementById('btn-eraser');
if (btnEraser) {
    console.log('11.4. Attaching listener to btnEraser.');
    btnEraser.addEventListener('click', toggleEraserMode);
} else {
    console.warn('!!! Aviso 11.4: btnEraser not found in the DOM.');
}

// Botões Salvar/Carregar Estado (Temporariamente Desativados)
if (btnSaveState) {
    console.log('11.5. Attaching listener to btnSaveState (Desativado).');
    btnSaveState.addEventListener('click', saveState);
} else {
    console.error('!!! Erro 11.5: btnSaveState not found.');
}

if (btnLoadState) {
    console.log('11.6. Attaching listener to btnLoadState (Desativado).');
    btnLoadState.addEventListener('click', loadState);
} else {
    console.error('!!! Erro 11.6: btnLoadState not found.');
}

// Botões do Modal
if (modalBtnSave) {
    console.log('11.7. Attaching listener to modalBtnSave.');
    modalBtnSave.addEventListener('click', saveAnnotation);
} else {
    console.error('!!! Erro 11.7: modalBtnSave not found.');
}

if (modalBtnCancel) {
    console.log('11.8. Attaching listener to modalBtnCancel.');
    modalBtnCancel.addEventListener('click', hideAnnotationModal);
} else {
    console.error('!!! Erro 11.8: modalBtnCancel not found.');
}

console.log('11.9. All button listeners attached.');


// --- 12.0. Inicialização Final da Aplicação ---
// Chama a função principal de inicialização
initThreeJS();