// App State
let state = {
    token: localStorage.getItem('astra_token') || null,
    username: localStorage.getItem('astra_username') || null,
    currentView: localStorage.getItem('astra_token') ? 'home' : 'login',
    currentSubjectId: null,
    currentTopicId: null,
    subjects: [],
    currentCards: [],
    topics: [],
    testQuestions: [],
    currentTestIndex: 0
};

const appContainer = document.getElementById('app-container');

// Helper to make authenticated fetch requests
async function authFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (state.token) {
        options.headers['Authorization'] = `Bearer ${state.token}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        logout();
        throw new Error('Sesión expirada');
    }
    return res;
}

function logout() {
    localStorage.removeItem('astra_token');
    localStorage.removeItem('astra_username');
    state.token = null;
    state.username = null;
    state.currentView = 'login';
    render();
}

async function loadSubjects() {
    try {
        const response = await authFetch(`/api/subjects`);
        state.subjects = await response.json();
    } catch(e) { console.error("Error", e); }
}

async function loadTopics(subjectId) {
    try {
        const response = await authFetch(`/api/topics/${subjectId}`);
        state.topics = await response.json();
    } catch(e) { console.error("Error", e); }
}

async function render() {
    appContainer.innerHTML = '';
    
    if (state.currentView === 'login') {
        renderLogin();
        return;
    }
    
    if (state.currentView !== 'tinder' && state.currentView !== 'test_quiz') {
        const header = document.createElement('div');
        header.className = 'header';
        const userInitial = state.username ? state.username.charAt(0).toUpperCase() : 'U';
        header.innerHTML = `
            <h1>Astra</h1>
            <div style="width: 40px; height: 40px; border-radius: 20px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer;" onclick="logout()" title="Cerrar Sesión">
                ${userInitial}
            </div>
        `;
        appContainer.appendChild(header);
    }
    
    const viewContainer = document.createElement('div');
    viewContainer.className = 'view';
    
    if (state.currentView === 'home') {
        await loadSubjects();
        renderHome(viewContainer);
    }
    if (state.currentView === 'subject') {
        await loadTopics(state.currentSubjectId);
        renderSubjectDetail(viewContainer);
    }
    if (state.currentView === 'tinder') renderTinder(viewContainer);
    if (state.currentView === 'test_quiz') renderTestQuiz(viewContainer);
    if (state.currentView === 'stats') renderStats(viewContainer);
    
    appContainer.appendChild(viewContainer);
    if (state.currentView !== 'tinder' && state.currentView !== 'test_quiz') {
        renderBottomNav();
    }
}

function renderLogin() {
    appContainer.innerHTML = `
        <div style="padding: 40px 24px; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
            <h1 style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, var(--primary), #9333EA); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">Astra Learn</h1>
            <p style="color: var(--text-muted); margin-bottom: 40px;">Tu tutor universitario con IA</p>
            
            <div style="background: var(--surface); padding: 24px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid var(--border);">
                <input type="text" id="username" placeholder="Nombre de usuario" style="width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid var(--border); border-radius: 12px; font-size: 16px;">
                <input type="password" id="password" placeholder="Contraseña" style="width: 100%; padding: 14px; margin-bottom: 24px; border: 1px solid var(--border); border-radius: 12px; font-size: 16px;">
                
                <button onclick="handleLogin()" style="width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 16px; margin-bottom: 12px; cursor: pointer;">Iniciar Sesión</button>
                <button onclick="handleRegister()" style="width: 100%; padding: 14px; background: #eee; color: var(--text-main); border: none; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer;">Crear Cuenta</button>
                <div id="auth-error" style="color: var(--danger); margin-top: 16px; font-size: 14px; font-weight: bold;"></div>
            </div>
        </div>
    `;
}

window.handleLogin = async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const err = document.getElementById('auth-error');
    if(!user || !pass) return err.innerText = "Completa los campos";
    
    err.innerText = "Conectando...";
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('astra_token', data.token);
            localStorage.setItem('astra_username', data.username);
            state.token = data.token;
            state.username = data.username;
            state.currentView = 'home';
            render();
        } else {
            err.innerText = data.error;
        }
    } catch(e) { err.innerText = "Error de red"; }
};

window.handleRegister = async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const err = document.getElementById('auth-error');
    if(!user || !pass) return err.innerText = "Completa los campos";
    
    err.innerText = "Creando cuenta...";
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        if (res.ok) {
            handleLogin();
        } else {
            err.innerText = data.error;
        }
    } catch(e) { err.innerText = "Error de red"; }
};

function renderHome(container) {
    const welcome = document.createElement('div');
    welcome.style.marginBottom = '28px';
    welcome.style.marginTop = '12px';
    welcome.innerHTML = `<h2 style="font-size: 32px; font-weight: 800; letter-spacing: -1px;">Hola, ${state.username || 'estudiante'}</h2><p style="color: var(--text-muted); font-size: 15px; margin-top: 6px;">¿Qué estudiamos hoy?</p>`;
    
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '16px';
    headerRow.innerHTML = `<h3 class="section-title" style="margin-bottom:0;">Tus Materias</h3>`;
    
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Nueva';
    addBtn.className = 'action-btn';
    addBtn.style.padding = '8px 16px';
    addBtn.style.background = 'var(--primary)';
    addBtn.style.color = 'white';
    addBtn.onclick = async () => {
        const name = prompt("Nombre de la nueva materia:");
        const icon = prompt("Icono (e.g., fa-book):") || 'fa-book';
        const color = prompt("Color (e.g., #4F46E5):") || '#4F46E5';
        if (name) {
            await authFetch(`/api/subjects`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name, icon, color})
            });
            render();
        }
    };
    headerRow.appendChild(addBtn);
    
    const cardList = document.createElement('div');
    cardList.className = 'card-list';
    
    if (state.subjects.length === 0) {
        cardList.innerHTML = '<p style="text-align:center; padding: 40px 20px; color: var(--text-muted); border: 2px dashed var(--border); border-radius: 16px;">No tienes materias. ¡Crea una para empezar!</p>';
    }
    
    state.subjects.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-icon" style="color: ${subject.color}; background: ${subject.color}15;">
                <i class="fa-solid ${subject.icon}"></i>
            </div>
            <div class="subject-info" style="flex: 1;" onclick="state.currentSubjectId = ${subject.id}; state.currentView = 'subject'; render();">
                <h3>${subject.name}</h3>
                <p>${subject.progress}% hacia el 10 (${subject.total_cards} tarjetas)</p>
                <div style="height: 6px; background: var(--border); border-radius: 3px; margin-top: 10px; overflow: hidden;">
                    <div style="width: ${subject.progress}%; height: 100%; background: ${subject.color}; border-radius: 3px;"></div>
                </div>
            </div>
            <button onclick="deleteSubject(${subject.id})" style="background:none; border:none; color:var(--danger); font-size:18px; cursor:pointer; padding: 10px;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        cardList.appendChild(card);
    });
    
    container.appendChild(welcome);
    container.appendChild(headerRow);
    container.appendChild(cardList);
}

function renderSubjectDetail(container) {
    const subject = state.subjects.find(s => s.id === state.currentSubjectId);
    if (!subject) return goHome();
    
    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px;">
            <button onclick="goHome()" style="background:none; border:none; font-size:20px; cursor:pointer;"><i class="fa-solid fa-arrow-left"></i></button>
            <h2 style="font-size:20px; font-weight:700;">${subject.name}</h2>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:24px;">
            <h4 style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">Progreso General</h4>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                <span style="font-size:32px; font-weight:800; color:var(--primary); line-height:1;">${subject.progress}%</span>
                <span style="font-size:13px; color:var(--text-muted);">${subject.total_cards} Tarjetas</span>
            </div>
            <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                <div style="width: ${subject.progress}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
            </div>
        </div>
    `;
    
    const finalTestBtn = document.createElement('button');
    finalTestBtn.style = 'width:100%; padding:16px; background:linear-gradient(135deg, #F59E0B, #EF4444); color:white; border:none; border-radius:16px; font-weight:700; font-size:16px; cursor:pointer; margin-bottom:24px; box-shadow:0 4px 12px rgba(239,68,68,0.3);';
    finalTestBtn.innerHTML = '<i class="fa-solid fa-graduation-cap" style="margin-right:8px;"></i> Simular Examen Final (Todo)';
    finalTestBtn.onclick = () => startTest({subject_id: subject.id, limit: 10});
    container.appendChild(finalTestBtn);
    
    const topicsHeader = document.createElement('div');
    topicsHeader.style = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;';
    topicsHeader.innerHTML = '<h3 class="section-title" style="margin:0;">Archivos (Temas)</h3>';
    
    const uploadForm = document.createElement('div');
    uploadForm.style = 'margin-bottom: 20px; background: var(--surface); padding: 16px; border-radius: 12px; border: 1px solid var(--border);';
    uploadForm.innerHTML = `
        <label style="display:block; font-weight:bold; margin-bottom:8px; font-size:14px;">1. Selecciona tu PDF:</label>
        <input type="file" id="pdf-file-input" accept=".pdf" style="display: block; font-size: 16px; padding: 10px; background: #eee; border-radius: 8px; width: 100%; margin-bottom: 12px;">
        <label style="display:block; font-weight:bold; margin-bottom:8px; font-size:14px; margin-top: 16px;">2. Sube el archivo:</label>
        <button type="button" onclick="uploadPDF(${subject.id})" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer;">Subir PDF 📤</button>
        <div id="upload-status" style="margin-top: 12px; font-size: 14px; font-weight: bold; color: var(--primary);"></div>
    `;
    
    topicsHeader.appendChild(uploadForm);
    container.appendChild(topicsHeader);
    
    if (state.topics.length === 0) {
        container.innerHTML += '<p style="color:var(--text-muted); text-align:center; padding:20px;">Sube tu primer PDF para crear un tema.</p>';
    } else {
        state.topics.forEach(t => {
            const topicCard = document.createElement('div');
            topicCard.style = 'background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px; margin-bottom:12px;';
            topicCard.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items: center;">
                    <h4 style="font-size:16px; font-weight:700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;" title="${t.name}">${t.name}</h4>
                    <div style="display:flex; align-items:center; gap: 12px; flex-shrink: 0;">
                        <span style="font-size:14px; font-weight:700; color:var(--primary);">${t.progress}%</span>
                        <button onclick="deleteTopic(${t.id}, ${subject.id})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 14px;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="t-btn tinder-btn" style="flex:1; padding:10px; border-radius:10px; border:none; background:var(--primary-light); color:var(--primary); font-weight:700; cursor:pointer;">
                        <i class="fa-solid fa-layer-group"></i> Repasar
                    </button>
                    <button class="t-btn test-btn" style="flex:1; padding:10px; border-radius:10px; border:none; background:#FEF2F2; color:#EF4444; font-weight:700; cursor:pointer;">
                        <i class="fa-solid fa-bolt"></i> Test Rápido
                    </button>
                </div>
            `;
            
            topicCard.querySelector('.tinder-btn').onclick = async () => {
                const res = await authFetch(`/api/cards/topic/${t.id}`);
                const data = await res.json();
                if (data.cards && data.cards.length > 0) {
                    state.currentCards = data.cards;
                    state.currentTopicId = t.id;
                    state.currentView = 'tinder';
                    render();
                } else {
                    alert('No hay tarjetas pendientes en este tema.');
                }
            };
            
            topicCard.querySelector('.test-btn').onclick = () => startTest({topic_id: t.id, limit: 5});
            
            container.appendChild(topicCard);
        });
    }
}

window.uploadPDF = async (subjectId) => {
    const fileInput = document.getElementById('pdf-file-input');
    const statusBox = document.getElementById('upload-status');
    const btn = document.querySelector('button[onclick*="uploadPDF"]');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if(statusBox) statusBox.innerHTML = '<span style="color: #EF4444;">Por favor, selecciona un archivo primero.</span>';
        return;
    }
    
    const file = fileInput.files[0];
    if(statusBox) statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leyendo PDF y enviando al servidor...';
    if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await authFetch(`/api/extract/${subjectId}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            if (data.count === "Pendiente") {
                if(statusBox) statusBox.innerHTML = `<span style="color: #F59E0B;"><i class="fa-solid fa-clock"></i> PDF recibido. La IA está procesándolo en segundo plano. Las tarjetas aparecerán aquí en un par de minutos.</span>`;
                setTimeout(() => { loadTopics(subjectId).then(() => render()); }, 3000);
            } else if (data.count) {
                if(statusBox) statusBox.innerHTML = `<span style="color: #10B981;"><i class="fa-solid fa-check"></i> ¡Éxito! Se generaron ${data.count} tarjetas.</span>`;
                setTimeout(() => { loadTopics(subjectId).then(() => render()); }, 2000);
            }
        } else {
            if(statusBox) statusBox.innerHTML = `<span style="color: #EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error del servidor: ${data.error || 'Desconocido'}</span>`;
            if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
    } catch (err) { 
        if(statusBox) statusBox.innerHTML = `<span style="color: #EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error de conexión.</span>`;
        if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
};

window.deleteSubject = async (subjectId) => {
    if (!confirm("¿Seguro que quieres borrar esta materia?")) return;
    try {
        await authFetch(`/api/subjects/${subjectId}`, { method: 'DELETE' });
        goHome();
    } catch(e) { console.error("Error al borrar", e); }
};

window.deleteTopic = async (topicId, subjectId) => {
    if (!confirm("¿Seguro que quieres borrar este archivo?")) return;
    try {
        await authFetch(`/api/topics/${topicId}`, { method: 'DELETE' });
        loadTopics(subjectId).then(() => render());
    } catch(e) { console.error("Error al borrar", e); }
};

async function startTest(bodyParams) {
    appContainer.innerHTML = '<div style="display:flex; height:100vh; justify-content:center; align-items:center; flex-direction:column;"><i class="fa-solid fa-brain fa-bounce" style="font-size:48px; color:var(--primary); margin-bottom:20px;"></i><h3>La IA está armando tu examen...</h3></div>';
    try {
        const res = await authFetch(`/api/tests/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(bodyParams)
        });
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
            state.testQuestions = data.questions;
            state.currentTestIndex = 0;
            state.currentView = 'test_quiz';
            render();
        } else {
            alert(data.error || 'No tienes suficientes tarjetas aprendidas para este test.');
            state.currentView = 'subject';
            render();
        }
    } catch(e) {
        alert("Error de conexión al generar el examen.");
        state.currentView = 'subject';
        render();
    }
}

function renderTestQuiz(container) {
    if (state.currentTestIndex >= state.testQuestions.length) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; height:100vh; display:flex; flex-direction:column; justify-content:center;">
                <i class="fa-solid fa-trophy" style="font-size:64px; color:#F59E0B; margin-bottom:24px;"></i>
                <h2 style="font-size:28px; margin-bottom:12px;">¡Examen Finalizado!</h2>
                <button onclick="state.currentView='subject'; render();" style="width:100%; padding:16px; background:var(--primary); color:white; border:none; border-radius:16px; font-weight:700; font-size:16px;">Volver a la materia</button>
            </div>
        `;
        return;
    }
    
    const q = state.testQuestions[state.currentTestIndex];
    container.innerHTML = `
        <div style="padding:20px 0;">
            <div style="display:flex; justify-content:space-between; margin-bottom:24px; color:var(--text-muted); font-weight:600; font-size:14px;">
                <span>Pregunta ${state.currentTestIndex + 1} de ${state.testQuestions.length}</span>
                <button onclick="state.currentView='subject'; render();" style="background:none; border:none; color:#EF4444; font-weight:700;"><i class="fa-solid fa-xmark"></i> Salir</button>
            </div>
            <h2 style="font-size:22px; font-weight:700; line-height:1.4; margin-bottom:32px;">${q.question}</h2>
            <div id="options-container" style="display:flex; flex-direction:column; gap:12px;"></div>
            <div id="feedback-box" style="display:none; margin-top:24px; padding:16px; border-radius:12px; font-size:14px; line-height:1.5;"></div>
            <button id="next-btn" style="display:none; width:100%; padding:16px; background:var(--primary); color:white; border:none; border-radius:16px; font-weight:700; font-size:16px; margin-top:24px;">Siguiente Pregunta</button>
        </div>
    `;
    
    const optionsContainer = container.querySelector('#options-container');
    const feedbackBox = container.querySelector('#feedback-box');
    const nextBtn = container.querySelector('#next-btn');
    let answered = false;
    
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.style = 'width:100%; padding:16px; text-align:left; background:var(--surface); border:2px solid var(--border); border-radius:12px; font-size:15px; font-weight:600; cursor:pointer;';
        btn.innerText = opt;
        btn.onclick = () => {
            if (answered) return;
            answered = true;
            if (index === q.correct_index) {
                feedbackBox.style.background = '#ECFDF5';
                feedbackBox.style.color = '#047857';
                feedbackBox.innerHTML = `<strong>¡Correcto!</strong><br>${q.justification}`;
            } else {
                feedbackBox.style.background = '#FEF2F2';
                feedbackBox.style.color = '#B91C1C';
                feedbackBox.innerHTML = `<strong>Incorrecto.</strong><br>${q.justification}`;
                authFetch(`/api/cards/${q.card_id}/fail`, { method: 'POST' });
            }
            feedbackBox.style.display = 'block';
            nextBtn.style.display = 'block';
        };
        optionsContainer.appendChild(btn);
    });
    nextBtn.onclick = () => { state.currentTestIndex++; render(); };
}

function renderStats(container) {
    const totalCards = state.subjects.reduce((sum, s) => sum + (s.total_cards || 0), 0);
    const avgProgress = state.subjects.length > 0 ? Math.round(state.subjects.reduce((sum, s) => sum + (s.progress || 0), 0) / state.subjects.length) : 0;
    
    container.innerHTML = `
        <h2 style="font-size:28px; font-weight:800; margin-bottom:24px;">Tu Progreso Global</h2>
        <div style="background:var(--primary); color:white; padding:24px; border-radius:20px; text-align:center; margin-bottom:24px; box-shadow:0 8px 24px rgba(79,70,229,0.3);">
            <i class="fa-solid fa-trophy" style="font-size:48px; margin-bottom:16px;"></i>
            <h3 style="font-size:36px; font-weight:900; margin-bottom:8px;">${avgProgress}%</h3>
            <p style="font-weight:600; opacity:0.9;">Camino al 10 completado</p>
        </div>
        <div style="display:flex; gap:16px; margin-bottom:32px;">
            <div style="flex:1; background:var(--surface); border:1px solid var(--border); padding:20px; border-radius:16px; text-align:center;">
                <i class="fa-solid fa-book-open" style="font-size:24px; color:var(--primary); margin-bottom:12px;"></i>
                <h4 style="font-size:24px; font-weight:800; margin-bottom:4px;">${state.subjects.length}</h4>
                <p style="font-size:12px; color:var(--text-muted); font-weight:600;">Materias</p>
            </div>
            <div style="flex:1; background:var(--surface); border:1px solid var(--border); padding:20px; border-radius:16px; text-align:center;">
                <i class="fa-solid fa-layer-group" style="font-size:24px; color:#F59E0B; margin-bottom:12px;"></i>
                <h4 style="font-size:24px; font-weight:800; margin-bottom:4px;">${totalCards}</h4>
                <p style="font-size:12px; color:var(--text-muted); font-weight:600;">Tarjetas Generadas</p>
            </div>
        </div>
    `;
}

function renderTinder(container) {
    container.style.paddingTop = '24px';
    container.style.overflow = 'hidden';
    
    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
            <button onclick="state.currentView='subject'; render();" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-main);"><i class="fa-solid fa-arrow-left"></i></button>
            <div style="flex:1;">
                <h2 style="font-size: 20px; font-weight: 700;">Sesión de Repaso</h2>
                <p style="font-size: 12px; color: var(--text-muted);">${state.currentCards.length} tarjetas restantes</p>
            </div>
        </div>
    `;
    
    const cardsArea = document.createElement('div');
    cardsArea.className = 'tinder-card-container';
    
    if (state.currentCards.length === 0) {
        cardsArea.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-check-circle" style="font-size:48px; color:var(--success); margin-bottom:16px;"></i><h3 style="margin-bottom:8px;">¡Sesión Completada!</h3><p style="color:var(--text-muted);">Has repasado todas las tarjetas de esta ronda.</p></div>';
    } else {
        [...state.currentCards].reverse().forEach((c, i) => {
            const index = state.currentCards.length - 1 - i;
            const card = document.createElement('div');
            card.className = 'tinder-card';
            card.style.zIndex = state.currentCards.length - index;
            card.id = 'card-' + index;
            
            if (index > 0) {
                const scale = Math.max(0, 1 - (index * 0.05));
                const yPos = index * -15;
                card.style.transform = `scale(${scale}) translateY(${yPos}px)`;
                card.style.opacity = Math.max(0, 1 - (index * 0.2));
            }
            
            card.innerHTML = `
                <div class="tinder-card-inner" onclick="this.parentElement.classList.toggle('flipped'); document.getElementById('swipe-hint-${index}').style.display='block';">
                    <div class="tinder-card-front">
                        <div style="background: #EEF2FF; color: var(--primary); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px; display:inline-block; letter-spacing: 0.5px; text-transform: uppercase;">${c.type || 'Concepto'}</div>
                        <h2 style="font-size:24px; margin-bottom:16px;">${c.text}</h2>
                        <div style="margin-top: 24px; color: var(--primary); font-weight: bold; font-size: 14px; animation: pulse 2s infinite;"><i class="fa-solid fa-hand-pointer"></i> Toca para girar y ver respuesta</div>
                    </div>
                    <div class="tinder-card-back">
                        <h3 style="font-size:18px; margin-bottom:16px; color:var(--text-main);">${c.text}</h3>
                        <div style="font-size:16px; color:var(--text-muted); text-align:left; width:100%; max-height:300px; overflow-y:auto; line-height:1.6; padding-right:8px;">${c.desc}</div>
                        <div id="swipe-hint-${index}" style="display:none; margin-top: 24px; color: var(--text-muted); font-size: 13px; font-weight: bold;"><i class="fa-solid fa-arrows-left-right"></i> Ahora desliza la tarjeta (Swipe)</div>
                    </div>
                </div>
                <div class="swipe-overlay like" style="position:absolute; top:30px; left:30px; border: 4px solid #10B981; color:#10B981; padding:5px 10px; border-radius:10px; font-weight:900; font-size:24px; opacity:0; transform:rotate(-15deg); pointer-events:none; z-index: 10;">CLARÍSIMO</div>
                <div class="swipe-overlay nope" style="position:absolute; top:30px; right:30px; border: 4px solid #EF4444; color:#EF4444; padding:5px 10px; border-radius:10px; font-weight:900; font-size:24px; opacity:0; transform:rotate(15deg); pointer-events:none; z-index: 10;">ME FALTA</div>
            `;
            
            if (index === 0) initSwipe(card, c.id);
            cardsArea.appendChild(card);
        });
    }
    
    const buttons = document.createElement('div');
    buttons.className = 'swipe-buttons';
    if (state.currentCards.length > 0) {
        buttons.innerHTML = `
            <p style="font-size: 13px; color: var(--text-muted); text-align: center; margin-top: 10px;">
                Toca la tarjeta para voltearla. Luego deslízala hacia la derecha (<span style="color:#10B981;font-weight:bold;">Aprendida</span>) o hacia la izquierda (<span style="color:#EF4444;font-weight:bold;">Repasar pronto</span>).
            </p>
        `;
    }
    
    container.appendChild(cardsArea);
    container.appendChild(buttons);
}

function initSwipe(card, dbId) {
    let isDragging = false, startX = 0, startY = 0, currentX = 0, currentY = 0;
    const nopeOverlay = card.querySelector('.nope'), likeOverlay = card.querySelector('.like');

    const startDrag = (e) => {
        if (e.target.tagName.toLowerCase() === 'div' && e.target.style.overflowY === 'auto') return;
        if (!card.classList.contains('flipped')) return; // Solo permitir swipe si la tarjeta fue volteada
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const inner = card.querySelector('.tinder-card-inner');
        if (inner) inner.style.transition = 'none'; 
        card.style.cursor = 'grabbing';
    };

    const drag = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        currentX = clientX - startX; currentY = clientY - startY;
        const inner = card.querySelector('.tinder-card-inner');
        // Transform the inner card while keeping it flipped
        if (inner) inner.style.transform = `translate(${currentX}px, ${currentY}px) rotateY(180deg) rotateZ(${currentX * 0.05}deg)`;
        
        if (currentX > 0) {
            likeOverlay.style.opacity = currentX / 100; nopeOverlay.style.opacity = 0;
        } else {
            nopeOverlay.style.opacity = Math.abs(currentX) / 100; likeOverlay.style.opacity = 0;
        }
    };

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false; card.style.cursor = 'grab';
        if (currentX > 100) handleSwipeOut(card, 'right', dbId);
        else if (currentX < -100) handleSwipeOut(card, 'left', dbId);
        else {
            const inner = card.querySelector('.tinder-card-inner');
            if (inner) {
                inner.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                inner.style.transform = 'translate(0px, 0px) rotateY(180deg) rotateZ(0deg)';
            }
            nopeOverlay.style.opacity = 0; likeOverlay.style.opacity = 0;
        }
    };

    card.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag, {passive: false});
    document.addEventListener('mouseup', endDrag);
    card.addEventListener('touchstart', startDrag, {passive: true});
    document.addEventListener('touchmove', drag, {passive: false});
    document.addEventListener('touchend', endDrag);
    
    card.cleanupSwipe = () => {
        document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', drag); document.removeEventListener('touchend', endDrag);
    };
}

async function handleSwipeOut(card, direction, dbId) {
    if (card.cleanupSwipe) card.cleanupSwipe();
    const inner = card.querySelector('.tinder-card-inner');
    if (inner) {
        inner.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
        inner.style.transform = `translate(${direction === 'right' ? window.innerWidth : -window.innerWidth}px, ${direction === 'right' ? 100 : -100}px) rotateY(180deg) rotateZ(${direction === 'right' ? 30 : -30}deg)`;
        inner.style.opacity = '0';
    }
    
    if (direction === 'right') card.querySelector('.like').style.opacity = 1;
    else card.querySelector('.nope').style.opacity = 1;
    
    authFetch(`/api/cards/${dbId}/swipe`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({direction})
    });
    
    setTimeout(() => { state.currentCards.shift(); render(); }, 300);
}

window.simulateSwipe = function(direction) {
    const card = document.getElementById('card-0');
    if (card) handleSwipeOut(card, direction, state.currentCards[0].id);
};

function renderBottomNav() {
    const nav = document.createElement('div');
    nav.className = 'bottom-nav';
    const items = [{ id: 'home', icon: 'fa-house', label: 'Inicio' }, { id: 'stats', icon: 'fa-chart-pie', label: 'Estadísticas' }];
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `nav-item ${state.currentView === item.id ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
        div.onclick = () => { state.currentView = item.id; state.currentSubjectId = null; render(); };
        nav.appendChild(div);
    });
    appContainer.appendChild(nav);
}

window.goHome = () => { state.currentView = 'home'; state.currentSubjectId = null; render(); }

render();
