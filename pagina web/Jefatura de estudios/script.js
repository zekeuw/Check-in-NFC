// --- VARIABLES GLOBALES Y CONFIGURACIÓN ---
let BASE_URL = localStorage.getItem('sjr_base_url') || 'http://10.102.7.221:5000';
let API_KEY = localStorage.getItem('sjr_api_key') || 'kartu_prosim';
let miGraficoChartJs = null;
let miGraficoEstado = null; // NUEVA VARIABLE PARA EL SEGUNDO GRÁFICO
let intervalDashboard = null;

let modoEdicion = false;
let idPersonaEditando = null;
let listaAlumnosActual = [];
let listaProfesoresActual = [];

// Estado de ordenación de tablas
let ordenActual = { campo: null, asc: true };

const CURSOS_MAP = {
    '1eso': '1º ESO', '2eso': '2º ESO', '3eso': '3º ESO', '4eso': '4º ESO',
    '1bach': '1º Bach', '2bach': '2º Bach',
    '1smr': '1º SMR', '2smr': '2º SMR', '1dam': '1º DAM', '2dam': '2º DAM',
    '1for': '1º Forestal', '2for': '2º Forestal', '1gsfor': '1º G. Forestal', '2gsfor': '2º G. Forestal'
};

const DEPT_MAP = {
    'informatica': 'Informática', 'agraria': 'Agraria', 'matematicas': 'Matemáticas',
    'lengua': 'Lengua', 'ingles': 'Inglés', 'biologia_geologia': 'Biología',
    'fisica_quimica': 'Física y Química', 'educacion_fisica': 'Ed. Física'
};

// --- AUTENTICACIÓN Y SESIÓN ---
function realizarLogin(e) {
    e.preventDefault();
    let user = document.getElementById('login-user').value;
    let pass = document.getElementById('login-pass').value;
    
    if(user === 'admin' && pass === 'admin') {
        localStorage.setItem('sjr_logged_in', 'true');
        document.getElementById('login-wrapper').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        iniciarApp();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function cerrarSesion() {
    localStorage.removeItem('sjr_logged_in');
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('login-wrapper').style.display = 'flex';
    document.getElementById('login-pass').value = '';
    
    if(intervalDashboard) clearInterval(intervalDashboard);
}

function verificarSesionInicial() {
    if(localStorage.getItem('sjr_logged_in') === 'true') {
        document.getElementById('login-wrapper').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        iniciarApp();
    }
}

function iniciarApp() {
    cargarValoresConfiguracion();
    cargarDashboard();
    
    // Auto-actualización desactivada para evitar recargas constantes
    // intervalDashboard = setInterval(() => {
    //     if (!document.hidden) cargarDashboard();
    // }, 15000);
}

function togglePasswordVisibility(inputId, iconShowId, iconHideId) {
    let passInput = document.getElementById(inputId);
    let eyeShow = document.getElementById(iconShowId);
    let eyeHide = document.getElementById(iconHideId);

    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeShow.style.display = 'none';
        eyeHide.style.display = 'block';
    } else {
        passInput.type = 'password';
        eyeShow.style.display = 'block';
        eyeHide.style.display = 'none';
    }
}

// --- PANEL DE CONFIGURACIÓN ---
function cargarValoresConfiguracion() {
    document.getElementById('config-url').value = BASE_URL;
    document.getElementById('config-apikey').value = API_KEY;
}

function guardarConfiguracion() {
    let nuevaUrl = document.getElementById('config-url').value.trim();
    let nuevaKey = document.getElementById('config-apikey').value.trim();
    let feedback = document.getElementById('config-feedback');

    if (nuevaUrl === '') {
        feedback.innerHTML = '<span style="color:red;">La URL no puede estar vacía.</span>';
        return;
    }

    BASE_URL = nuevaUrl;
    API_KEY = nuevaKey;
    localStorage.setItem('sjr_base_url', BASE_URL);
    localStorage.setItem('sjr_api_key', API_KEY);

    feedback.innerHTML = '<span style="color:green;">Configuración guardada correctamente.</span>';
    
    setTimeout(() => {
        feedback.innerHTML = '';
        cargarDashboard();
    }, 2000);
}

// --- UTILIDADES ---
function formatCurso(clave) {
    if (CURSOS_MAP[clave]) return CURSOS_MAP[clave];
    if (clave) return clave;
    return '--';
}

function formatDept(clave) {
    if (DEPT_MAP[clave]) return DEPT_MAP[clave];
    if (clave) return clave;
    return 'Docente';
}

function toggleMenu() {
    let menu = document.getElementById('sidebar');
    menu.classList.toggle('show-menu');
}

function cambiarSeccion(idSeccion, botonClicado) {
    let todasLasSecciones = document.getElementsByClassName('seccion-app');
    for (let i = 0; i < todasLasSecciones.length; i++) {
        todasLasSecciones[i].style.display = 'none';
    }

    document.getElementById('sec-' + idSeccion).style.display = 'block';

    let todosLosBotones = document.getElementsByClassName('nav-btn');
    for (let i = 0; i < todosLosBotones.length; i++) {
        todosLosBotones[i].classList.remove('active');
    }

    if (botonClicado) {
        botonClicado.classList.add('active');
    }

    if (idSeccion === 'estadisticas') cargarDashboard();
    if (idSeccion === 'alumnado') cargarAlumnado();
    if (idSeccion === 'profesorado') cargarProfesorado();
    if (idSeccion === 'nfc') cargarSelectNFC();
    if (idSeccion === 'asistencia') cargarAsistencia();
    if (idSeccion === 'configuracion') cargarValoresConfiguracion();

    let menu = document.getElementById('sidebar');
    if (menu.classList.contains('show-menu')) {
        menu.classList.remove('show-menu');
    }
}

function actualizarEstadoConexion(estaConectado) {
    let contenedoresSubtitulo = document.querySelectorAll('.admin-subtitle');
    contenedoresSubtitulo.forEach(contenedor => {
        if (estaConectado) {
            contenedor.innerHTML = '<span id="sync-status" class="status-dot" style="background-color: #10b981;"></span> Conectado a Odoo';
        } else {
            contenedor.innerHTML = '<span id="sync-status" class="status-dot" style="background-color: #ef4444;"></span> Desconectado';
        }
    });
}

// --- FUNCIONES PARA GESTIONAR EL MODO DEL FORMULARIO ---
function prepararNuevoAlumno() {
    modoEdicion = false;
    idPersonaEditando = null;
    
    document.getElementById('add-al-nombre').value = '';
    document.getElementById('add-al-apellidos').value = '';
    document.getElementById('add-al-curso').value = '';
    document.getElementById('add-al-dni').value = '';
    document.getElementById('add-al-fecha').value = '';
    document.getElementById('add-al-nfc').value = '';
    document.getElementById('add-al-feedback').innerHTML = '';
    
    document.querySelector('#sec-crear-alumno h3').innerText = 'Registrar Nuevo Alumno';
    document.querySelector('#sec-crear-alumno .btn-large').innerText = 'REGISTRAR EN ODOO';
    
    cambiarSeccion('crear-alumno');
}

function prepararNuevoProfesor() {
    modoEdicion = false;
    idPersonaEditando = null;
    
    document.getElementById('add-pr-nombre').value = '';
    document.getElementById('add-pr-apellidos').value = '';
    document.getElementById('add-pr-departamento').value = '';
    document.getElementById('add-pr-dni').value = '';
    document.getElementById('add-pr-nfc').value = '';
    document.getElementById('add-pr-feedback').innerHTML = '';
    
    document.querySelector('#sec-crear-profesor h3').innerText = 'Registrar Nuevo Profesor';
    document.querySelector('#sec-crear-profesor .btn-large').innerText = 'REGISTRAR EN ODOO';
    
    cambiarSeccion('crear-profesor');
}

function modificarPersona(id, tipo) {
    modoEdicion = true;
    idPersonaEditando = id;

    if (tipo === 'alumno') {
        let alumno = listaAlumnosActual.find(a => a.id === id);
        if (!alumno) return;
        
        document.getElementById('add-al-nombre').value = alumno.nombre || '';
        document.getElementById('add-al-apellidos').value = alumno.apellidos || '';
        document.getElementById('add-al-curso').value = alumno.curso || '';
        document.getElementById('add-al-dni').value = alumno.dni || '';
        document.getElementById('add-al-fecha').value = alumno.fecha_nacimiento || '';
        document.getElementById('add-al-nfc').value = alumno.id_NFC || '';
        document.getElementById('add-al-feedback').innerHTML = '';
        
        document.querySelector('#sec-crear-alumno h3').innerText = 'Modificar Alumno';
        document.querySelector('#sec-crear-alumno .btn-large').innerText = 'GUARDAR CAMBIOS';
        
        cambiarSeccion('crear-alumno');

    } else if (tipo === 'profesor') {
        let profe = listaProfesoresActual.find(p => p.id === id);
        if (!profe) return;
        
        document.getElementById('add-pr-nombre').value = profe.nombre || '';
        document.getElementById('add-pr-apellidos').value = profe.apellidos || '';
        document.getElementById('add-pr-departamento').value = profe.departamento || '';
        document.getElementById('add-pr-dni').value = profe.dni || '';
        document.getElementById('add-pr-nfc').value = profe.id_NFC || '';
        document.getElementById('add-pr-feedback').innerHTML = '';
        
        document.querySelector('#sec-crear-profesor h3').innerText = 'Modificar Profesor';
        document.querySelector('#sec-crear-profesor .btn-large').innerText = 'GUARDAR CAMBIOS';
        
        cambiarSeccion('crear-profesor');
    }
}


// --- CARGA DEL DASHBOARD Y ESTADÍSTICAS ---
async function cargarDashboard() {
    try {
        let tipoSeleccionado = document.getElementById('filtro-dashboard-tipo').value;
        let respuesta = await fetch(BASE_URL + '/api/dashboard?tipo=' + tipoSeleccionado, {headers: {"x-api-key": API_KEY}});

        if (!respuesta.ok) {
            throw new Error("Fallo en la peticion al servidor");
        }

        let datos = await respuesta.json();

        if (datos.status === 'error') {
            actualizarEstadoConexion(false);
            document.getElementById('odoo-table-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Sin conexión con Odoo.</td></tr>';
            return;
        }

        actualizarEstadoConexion(true);

        let listaPersonas = [];
        if (datos.alumnos) listaPersonas = datos.alumnos;
        else if (datos.profesores) listaPersonas = datos.profesores;
        else if (datos.data) listaPersonas = datos.data;
        
        let htmlTabla = '';
        
        let countCentro = 0;
        let countRecreo = 0;
        let countSalida = 0;

        for (let i = 0; i < listaPersonas.length; i++) {
            let persona = listaPersonas[i];
            
            if (persona.salida_anticipada) countSalida++;
            else if (persona.recreo) countRecreo++;
            else countCentro++;
            
            let identificadorNfc = persona.nfc_id || persona.id_NFC;
            let nombrePersona = persona.name || persona.nombre;

            let subtitulo = persona.curso ? formatCurso(persona.curso) : formatDept(persona.departamento);

            if (identificadorNfc) htmlTabla += '<tr>';
            else htmlTabla += '<tr class="alert-row">';

            htmlTabla += '<td>';
            htmlTabla += '<div class="user-info">';
            htmlTabla += '<span class="user-name">' + nombrePersona + '</span>';
            htmlTabla += '<span class="user-meta">' + subtitulo + '</span>';
            htmlTabla += '</div></td>';

            htmlTabla += '<td>';
            if (identificadorNfc) htmlTabla += '<span class="nfc-tag">' + identificadorNfc + '</span>';
            else htmlTabla += '<span class="badge-error">SIN TAG</span>';
            htmlTabla += '</td>';

            let recreoClase = persona.recreo ? 'nfc-tag' : 'badge-error';
            let recreoTexto = persona.recreo ? 'EN RECREO' : 'EN CENTRO';
            htmlTabla += '<td style="text-align:center;">';
            htmlTabla += '<span class="' + recreoClase + '" style="font-size: 11px;">' + recreoTexto + '</span>';
            htmlTabla += '</td>';

            let salidaClase = persona.salida_anticipada ? 'badge-error' : 'nfc-tag';
            let salidaTexto = persona.salida_anticipada ? 'HA SALIDO' : 'EN EL CENTRO';
            htmlTabla += '<td style="text-align:center;">';
            htmlTabla += '<span class="' + salidaClase + '" style="font-size: 11px;">' + salidaTexto + '</span>';
            htmlTabla += '</td>';

            htmlTabla += '</tr>';
        }

        document.getElementById('odoo-table-body').innerHTML = htmlTabla;

        document.getElementById('stat-centro').innerText = countCentro;
        document.getElementById('stat-recreo').innerText = countRecreo;
        document.getElementById('stat-salidas').innerText = countSalida;
        
        let incidenciasTotales = datos.stats ? (datos.stats.incidencias || 0) : 0;
        document.getElementById('stat-incidencias').innerText = incidenciasTotales;

        let respuestaAsis = await fetch(BASE_URL + '/api/asistencia?filtro=' + tipoSeleccionado, {headers: {"x-api-key": API_KEY}});
        let jsonAsistencia = await respuestaAsis.json();

        let conteoSalidasSemana = [0, 0, 0, 0, 0];
        let conteoRetrasosSemana = [0, 0, 0, 0, 0];
        let etiquetasDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        
        let feedHtml = '';

        if (jsonAsistencia.status === 'success') {
            let hoy = new Date();
            let listaAsistencia = jsonAsistencia.data || [];
            
            for (let i = 0; i < listaAsistencia.length; i++) {
                let reg = listaAsistencia[i];
                let textoTipo = String(reg.tipo).toLowerCase();

                let fechaSola = reg.hora.split(' ')[0];
                let partesFecha = fechaSola.split('/');

                if (partesFecha.length === 3) {
                    let fechaRegistro = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
                    let diferenciaTiempo = hoy.getTime() - fechaRegistro.getTime();
                    let diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

                    if (diferenciaDias <= 7) {
                        let diaSemana = fechaRegistro.getDay();
                        if (diaSemana >= 1 && diaSemana <= 5) {
                            if (textoTipo.includes('salida')) {
                                conteoSalidasSemana[diaSemana - 1]++;
                            } else if (textoTipo.includes('tarde') || textoTipo.includes('retraso')) {
                                conteoRetrasosSemana[diaSemana - 1]++;
                            }
                        }
                    }
                }
            }
            
            let ultimasActividades = listaAsistencia.slice(0, 8);
            if(ultimasActividades.length === 0) {
                feedHtml = '<div style="text-align:center; color:#64748b; padding: 20px;">No hay actividad reciente.</div>';
            } else {
                ultimasActividades.forEach(act => {
                    let horaPartida = act.hora.split(' ')[1] || act.hora;
                    let horaLimpia = horaPartida.split(':').slice(0, 2).join(':'); 
                    
                    let tipoLimpio = String(act.tipo).toLowerCase();
                    let badgeColor = '#3b82f6';
                    
                    if (tipoLimpio.includes('salida')) badgeColor = '#e11d48';
                    else if (tipoLimpio.includes('tarde') || tipoLimpio.includes('retraso')) badgeColor = '#f59e0b';
                    
                    feedHtml += `
                    <div class="activity-item">
                        <div class="act-time">${horaLimpia}</div>
                        <div class="act-details">
                            <span class="act-name">${act.nombre}</span>
                            <span class="act-type" style="color: ${badgeColor};">${act.tipo}</span>
                        </div>
                    </div>`;
                });
            }
        }
        
        document.getElementById('activity-feed').innerHTML = feedHtml;

        let diaDeHoy = new Date().getDay();
        if (diaDeHoy >= 1 && diaDeHoy <= 5 && datos.stats) {
            let salidasActivasHoy = countSalida; 
            if (salidasActivasHoy > conteoSalidasSemana[diaDeHoy - 1]) {
                conteoSalidasSemana[diaDeHoy - 1] = salidasActivasHoy;
            }
        }

        const ctx = document.getElementById('odoo-chart').getContext('2d');
        if (miGraficoChartJs !== null) miGraficoChartJs.destroy();
        
        miGraficoChartJs = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetasDias,
                datasets: [
                    {
                        label: 'Salidas Anticipadas',
                        data: conteoSalidasSemana,
                        backgroundColor: 'rgba(225, 29, 72, 0.85)',
                        borderRadius: 4,
                        barThickness: 20
                    },
                    {
                        label: 'Retrasos',
                        data: conteoRetrasosSemana,
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderRadius: 4,
                        barThickness: 20
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: { font: { family: 'Arial', size: 12 }, usePointStyle: true, boxWidth: 10 }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleFont: { size: 14, family: 'Arial' },
                        bodyFont: { size: 13, family: 'Arial' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: '#64748b' },
                        grid: { color: '#e2e8f0', borderDash: [5, 5] },
                        border: { display: false }
                    },
                    x: {
                        ticks: { color: '#64748b', font: { weight: 'bold' } },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });

        const ctxEstado = document.getElementById('estado-chart').getContext('2d');
        if (miGraficoEstado !== null) miGraficoEstado.destroy();

        miGraficoEstado = new Chart(ctxEstado, {
            type: 'doughnut',
            data: {
                labels: ['En Centro', 'En Recreo', 'Han Salido'],
                datasets: [{
                    data: [countCentro, countRecreo, countSalida],
                    backgroundColor: ['#10b981', '#f59e0b', '#e11d48'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', 
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: 'Arial', size: 12, color: '#475569' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        bodyFont: { size: 14 }
                    }
                }
            }
        });

    } catch (error) {
        actualizarEstadoConexion(false);
        console.error("Error Dashboard:", error);
        document.getElementById('odoo-table-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error de conexión.</td></tr>';
    }
}

// --- LÓGICA DE ALUMNADO ---
async function cargarAlumnado() {
    let cuerpoTabla = document.getElementById('alumnado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/alumnado', {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            listaAlumnosActual = json.data;
            document.getElementById('check-all-al').checked = false;
            aplicarFiltrosAvanzados();
        }
    } catch (error) {
        console.error(error);
        cuerpoTabla.innerHTML = '<tr><td colspan="9" style="color:red; text-align:center;">Error de conexión</td></tr>';
    }
}

function aplicarFiltrosAvanzados() {
    let texto = document.getElementById('search-alumnado').value.toLowerCase();
    let curso = document.getElementById('filtro-curso-al').value;
    let estadoNfc = document.getElementById('filtro-nfc-al').value;

    let listaFiltrada = listaAlumnosActual.filter(al => {
        let textoBusqueda = (al.nombre + ' ' + (al.apellidos || '') + ' ' + (al.dni || '')).toLowerCase();
        let cumpleTexto = textoBusqueda.includes(texto);
        let cumpleCurso = (curso === 'todos') || (al.curso === curso);
        
        let tieneNfc = Boolean(al.id_NFC && al.id_NFC !== "false" && String(al.id_NFC).trim() !== "");
        
        let cumpleNfc = (estadoNfc === 'todos') || 
                        (estadoNfc === 'con' && tieneNfc) || 
                        (estadoNfc === 'sin' && !tieneNfc);
                        
        return cumpleTexto && cumpleCurso && cumpleNfc;
    });

    renderizarAlumnado(listaFiltrada);
}

function ordenarAlumnosPor(campo) {
    if (ordenActual.campo === campo) {
        ordenActual.asc = !ordenActual.asc;
    } else {
        ordenActual.campo = campo;
        ordenActual.asc = true;
    }

    listaAlumnosActual.sort((a, b) => {
        let valA = a[campo] ? String(a[campo]).toLowerCase() : '';
        let valB = b[campo] ? String(b[campo]).toLowerCase() : '';

        if (valA < valB) return ordenActual.asc ? -1 : 1;
        if (valA > valB) return ordenActual.asc ? 1 : -1;
        return 0;
    });

    aplicarFiltrosAvanzados();
}

function renderizarAlumnado(listaA_Mostrar) {
    let cuerpoTabla = document.getElementById('alumnado-body');
    let htmlNuevo = '';

    if (listaA_Mostrar.length === 0) {
        cuerpoTabla.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: #64748b;">No se encontraron alumnos con los filtros actuales.</td></tr>';
        verificarSeleccionLote();
        return;
    }

    for (let i = 0; i < listaA_Mostrar.length; i++) {
        let alumno = listaA_Mostrar[i];
        let dniTexto = alumno.dni ? alumno.dni : '--';

        let etiquetaNfc = '<span class="badge-error">PENDIENTE</span>';
        if (alumno.id_NFC) {
            etiquetaNfc = '<span class="nfc-tag">' + alumno.id_NFC + '</span>';
        }

        let nombreParaAvatar = alumno.nombre + '+' + (alumno.apellidos || '');
        nombreParaAvatar = nombreParaAvatar.split(' ').join('+');
        let urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
        let imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

        let checkRecreo = alumno.recreo === true ? 'checked' : '';
        let switchRecreo = `
                <label class="switch">
                    <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'recreo', this.checked, 'alumno')" ${checkRecreo}>
                    <span class="slider recreo-slider"></span>
                </label>
            `;

        let checkSalida = alumno.salida_anticipada === true ? 'checked' : '';
        let switchSalida = `
                <label class="switch">
                    <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'salida_anticipada', this.checked, 'alumno')" ${checkSalida}>
                    <span class="slider salida-slider"></span>
                </label>
            `;

        let btnEditar = `<button class="btn-editar" onclick="modificarPersona(${alumno.id}, 'alumno')" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>`;

        let btnBorrarAl = `<button class="btn-borrar" onclick="borrarPersona(${alumno.id}, 'alumno')" title="Dar de baja">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        </button>`;

        htmlNuevo += '<tr>';
        htmlNuevo += `<td style="text-align:center;"><input type="checkbox" class="check-alumno" value="${alumno.id}" onchange="verificarSeleccionLote()"></td>`;
        htmlNuevo += `<td style="text-align:center;">${imagenHtml}</td>`;
        htmlNuevo += `<td><span class="user-name">${alumno.nombre} ${alumno.apellidos || ''}</span></td>`;
        htmlNuevo += `<td><span class="user-meta" style="color:#000; font-weight:500;">${formatCurso(alumno.curso)}</span></td>`;
        htmlNuevo += `<td>${dniTexto}</td>`;
        htmlNuevo += `<td style="text-align:center;">${etiquetaNfc}</td>`;
        htmlNuevo += `<td style="text-align:center; vertical-align:middle;">${switchRecreo}</td>`;
        htmlNuevo += `<td style="text-align:center; vertical-align:middle;">${switchSalida}</td>`;
        htmlNuevo += `<td style="text-align:center; vertical-align:middle; white-space: nowrap;">${btnEditar}${btnBorrarAl}</td>`;
        htmlNuevo += '</tr>';
    }
    
    cuerpoTabla.innerHTML = htmlNuevo;
    verificarSeleccionLote();
}

function toggleSelectAll(checkboxGeneral) {
    let checkboxes = document.querySelectorAll('.check-alumno');
    checkboxes.forEach(cb => {
        cb.checked = checkboxGeneral.checked;
    });
    verificarSeleccionLote();
}

function verificarSeleccionLote() {
    let seleccionados = document.querySelectorAll('.check-alumno:checked').length;
    let barraLote = document.getElementById('bulk-actions-al');
    let contadorTxt = document.getElementById('contador-seleccion-al');
    
    if (seleccionados > 0) {
        barraLote.style.display = 'flex';
        contadorTxt.innerText = seleccionados;
    } else {
        barraLote.style.display = 'none';
        document.getElementById('check-all-al').checked = false;
    }
}

async function aplicarAccionLote(accion, valorBoleano) {
    let checkboxes = document.querySelectorAll('.check-alumno:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`¿Estás seguro de modificar ${checkboxes.length} alumnos de golpe?`)) return;

    let feedback = document.getElementById('bulk-feedback');
    feedback.innerHTML = '<span style="color: #2563eb;">Procesando peticiones...</span>';

    try {
        for (let cb of checkboxes) {
            let id = parseInt(cb.value);
            
            if (accion === 'reset') {
                await fetch(BASE_URL + '/api/actualizar_estado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
                    body: JSON.stringify({ id: id, tipo: 'alumno', campo: 'recreo', valor: false })
                });
                await fetch(BASE_URL + '/api/actualizar_estado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
                    body: JSON.stringify({ id: id, tipo: 'alumno', campo: 'salida_anticipada', valor: false })
                });
            } else {
                await fetch(BASE_URL + '/api/actualizar_estado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
                    body: JSON.stringify({ id: id, tipo: 'alumno', campo: accion, valor: valorBoleano })
                });
            }
        }
        
        feedback.innerHTML = '<span style="color: #10b981;">¡Actualización masiva completada!</span>';
        setTimeout(() => {
            feedback.innerHTML = '';
            cargarAlumnado();
            cargarDashboard();
        }, 1000);

    } catch (error) {
        feedback.innerHTML = '<span style="color: #e11d48;">Hubo un error al procesar algunos registros.</span>';
        console.error(error);
    }
}

async function cambiarEstadoPersona(idPersona, campoCambiar, nuevoValor, tipoPersona) {
    try {
        let respuesta = await fetch(BASE_URL + '/api/actualizar_estado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify({ id: idPersona, tipo: tipoPersona, campo: campoCambiar, valor: nuevoValor })
        });

        let json = await respuesta.json();
        if (json.status === 'success' || json.status === 'exito') cargarDashboard();
        else { alert('No se pudo actualizar el estado.'); cargarAlumnado(); }
    } catch (error) {
        alert('Error de red al intentar cambiar el estado.');
        cargarAlumnado();
    }
}

async function crearAlumnoDesdeWeb() {
    let nombre = document.getElementById('add-al-nombre').value.trim();
    let apellidos = document.getElementById('add-al-apellidos').value.trim();
    let curso = document.getElementById('add-al-curso').value;
    let dni = document.getElementById('add-al-dni').value.trim();
    let fecha = document.getElementById('add-al-fecha').value;
    let nfc = document.getElementById('add-al-nfc').value.trim();
    let feedback = document.getElementById('add-al-feedback');

    if (nombre === '' || apellidos === '' || curso === '' || fecha === '') {
        feedback.innerHTML = '<span style="color:red;">⚠ Nombre, Apellidos, Curso y Fecha de Nacimiento son obligatorios</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando datos...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, curso: curso,
        dni: dni, fecha_nacimiento: fecha, id_NFC: nfc, tipo: 'alumno'
    };

    let urlPeticion = BASE_URL + (modoEdicion ? '/api/actualizar' : '/create');
    let metodoPeticion = modoEdicion ? 'PUT' : 'POST';

    if (modoEdicion) {
        datosEnviados.id = idPersonaEditando;
    }

    try {
        let respuesta = await fetch(urlPeticion, {
            method: metodoPeticion,
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">' + (modoEdicion ? 'Cambios guardados' : 'Alumno guardado') + ' correctamente. Redirigiendo...</span>';
            setTimeout(() => {
                cargarAlumnado();
                cambiarSeccion('alumnado', document.querySelectorAll('.nav-btn')[1]);
                modoEdicion = false;
                idPersonaEditando = null;
            }, 1500);
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">No se puede conectar al servidor</span>';
    }
}

// --- LÓGICA DE PROFESORADO ---
async function cargarProfesorado() {
    let cuerpoTabla = document.getElementById('profesorado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/profesorado', {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            listaProfesoresActual = json.data;
            aplicarFiltrosAvanzadosProfesores();
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error cargando profesores</td></tr>';
    }
}

function aplicarFiltrosAvanzadosProfesores() {
    let texto = document.getElementById('search-profesorado').value.toLowerCase();
    let departamento = document.getElementById('filtro-dept-pr').value;

    let listaFiltrada = listaProfesoresActual.filter(pr => {
        let textoBusqueda = (pr.nombre + ' ' + (pr.apellidos || '') + ' ' + (pr.dni || '')).toLowerCase();
        let cumpleTexto = textoBusqueda.includes(texto);
        let cumpleDept = (departamento === 'todos') || (pr.departamento === departamento);
        
        return cumpleTexto && cumpleDept;
    });

    renderizarProfesorado(listaFiltrada);
}

function renderizarProfesorado(listaA_Mostrar) {
    let cuerpoTabla = document.getElementById('profesorado-body');
    let htmlNuevo = '';

    if (listaA_Mostrar.length === 0) {
        cuerpoTabla.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #64748b;">No se encontraron profesores con los filtros actuales.</td></tr>';
        return;
    }

    for (let i = 0; i < listaA_Mostrar.length; i++) {
        let profe = listaA_Mostrar[i];
        let apellidoTexto = profe.apellidos ? profe.apellidos : '';
        let dniTexto = profe.dni ? profe.dni : '--';

        let etiquetaNfc = '<span class="badge-error">PENDIENTE</span>';
        if (profe.id_NFC) etiquetaNfc = '<span class="nfc-tag">' + profe.id_NFC + '</span>';

        htmlNuevo += '<tr>';
        htmlNuevo += '<td><span class="user-name">' + profe.nombre + ' ' + apellidoTexto + '</span></td>';
        htmlNuevo += '<td><span class="user-meta" style="color:#000; font-weight:500;">' + formatDept(profe.departamento) + '</span></td>';
        htmlNuevo += '<td>' + dniTexto + '</td>';
        htmlNuevo += '<td style="text-align:center;">' + etiquetaNfc + '</td>';
        
        let btnEditar = `<button class="btn-editar" onclick="modificarPersona(${profe.id}, 'profesor')" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>`;

        let btnBorrarPr = `<button class="btn-borrar" onclick="borrarPersona(${profe.id}, 'profesor')" title="Dar de baja">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>`;
        
        htmlNuevo += `<td style="text-align:center; white-space: nowrap;">${btnEditar}${btnBorrarPr}</td>`;
        htmlNuevo += '</tr>';
    }
    cuerpoTabla.innerHTML = htmlNuevo;
}

async function crearProfesorDesdeWeb() {
    let nombre = document.getElementById('add-pr-nombre').value.trim();
    let apellidos = document.getElementById('add-pr-apellidos').value.trim();
    let departamento = document.getElementById('add-pr-departamento').value;
    let dni = document.getElementById('add-pr-dni').value.trim();
    let nfc = document.getElementById('add-pr-nfc').value.trim();
    let feedback = document.getElementById('add-pr-feedback');

    if (nombre === '' || apellidos === '' || departamento === '') {
        feedback.innerHTML = '<span style="color:red;">⚠ Nombre, Apellidos y Departamento son obligatorios</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando datos...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, departamento: departamento,
        dni: dni, id_NFC: nfc, tipo: 'profesor'
    };

    let urlPeticion = BASE_URL + (modoEdicion ? '/api/actualizar' : '/create');
    let metodoPeticion = modoEdicion ? 'PUT' : 'POST';

    if (modoEdicion) {
        datosEnviados.id = idPersonaEditando;
    }

    try {
        let respuesta = await fetch(urlPeticion, {
            method: metodoPeticion,
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">' + (modoEdicion ? 'Cambios guardados' : 'Profesor guardado') + ' correctamente. Redirigiendo...</span>';
            setTimeout(() => {
                cargarProfesorado();
                cambiarSeccion('profesorado', document.querySelectorAll('.nav-btn')[2]);
                modoEdicion = false;
                idPersonaEditando = null;
            }, 1500);
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">No se puede conectar al servidor</span>';
    }
}

async function cargarAsistencia() {
    let cuerpoTabla = document.getElementById('asistencia-body');
    let filtroSeleccionado = document.getElementById('filtro-asistencia').value;
    let fechaSeleccionada = document.getElementById('filtro-fecha-asistencia').value;

    cuerpoTabla.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    try {
        let url = BASE_URL + '/api/asistencia?filtro=' + filtroSeleccionado;
        if (fechaSeleccionada) url += '&fecha=' + fechaSeleccionada;

        let respuesta = await fetch(url, {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let registro = json.data[i];

                let nombreParaAvatar = registro.nombre.split(' ').join('+');
                let urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
                let imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

                let estiloBadge = "background:#f1f5f9; color:#475569; border: 1px solid #e2e8f0;";
                let textoIncidencia = registro.tipo;

                let tipoTexto = String(registro.tipo).toLowerCase();

                if (tipoTexto.includes('tarde')) {
                    estiloBadge = "background:#fef08a; color:#854d0e; border: 1px solid #fde047;";
                    textoIncidencia = "Llegada Tarde";
                } else if (tipoTexto.includes('salida')) {
                    estiloBadge = "background:#fed7aa; color:#9a3412; border: 1px solid #fdba74;";
                    textoIncidencia = "Salida Anticipada";
                }

                htmlNuevo += `<tr>
                    <td style="text-align:center;">${imagenHtml}</td>
                    <td><span class="user-name">${registro.nombre}</span></td>
                    <td><span class="user-meta" style="text-transform: capitalize;">${registro.colectivo}</span></td>
                    <td><span class="badge-error" style="${estiloBadge}">${textoIncidencia}</span></td>
                    <td><strong>${registro.hora}</strong></td>
                    <td><span style="color:#64748b; font-size:0.85rem;">${registro.notas ? registro.notas : '--'}</span></td>
                </tr>`;
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Error de red.</td></tr>';
    }
}

async function cargarSelectNFC() {
    let tipoSeleccionado = document.getElementById('select-tipo-nfc').value;
    let desplegable = document.getElementById('select-persona-nfc');
    try {
        let ruta = tipoSeleccionado === 'profesores' ? '/api/profesorado' : '/api/alumnado';
        let respuesta = await fetch(BASE_URL + ruta, {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            let opcionesHtml = '<option value="">-- Selecciona --</option>';
            for (let i = 0; i < json.data.length; i++) {
                let p = json.data[i];
                let subt = tipoSeleccionado === 'alumnos' ? formatCurso(p.curso) : formatDept(p.departamento);
                opcionesHtml += `<option value="${p.id}">${p.nombre} ${p.apellidos || ''} - ${subt}</option>`;
            }
            desplegable.innerHTML = opcionesHtml;
        }
    } catch (error) {
        desplegable.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function guardarVinculacion() {
    let tipo = document.getElementById('select-tipo-nfc').value;
    let idPersona = document.getElementById('select-persona-nfc').value;
    let codigoNfc = document.getElementById('input-nfc-code').value;
    let feedback = document.getElementById('nfc-feedback');

    if (idPersona === '' || codigoNfc === '') { feedback.innerHTML = '<span style="color:red;">Faltan campos</span>'; return; }

    try {
        let respuesta = await fetch(BASE_URL + '/api/vincular_nfc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify({ id: parseInt(idPersona), nfc: codigoNfc, tipo: tipo })
        });
        let json = await respuesta.json();

        if (json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">¡Vinculado bien!</span>';
            document.getElementById('input-nfc-code').value = '';
        } else feedback.innerHTML = '<span style="color:red;">Error</span>';
    } catch (error) { feedback.innerHTML = '<span style="color:red;">Error de conexión</span>'; }
}

function aplicarFiltroBusqueda(inputId, tableBodyId) {
    let input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('input', function (evento) {
            let textoBuscado = evento.target.value.toLowerCase();
            let filas = document.getElementById(tableBodyId).getElementsByTagName('tr');

            for (let i = 0; i < filas.length; i++) {
                let textoFila = filas[i].innerText.toLowerCase();
                filas[i].style.display = textoFila.includes(textoBuscado) ? '' : 'none';
            }
        });
    }
}

function exportarCSV(tableBodyId) {
    let filas = document.getElementById(tableBodyId).getElementsByTagName('tr');
    let csvContent = "Nombre,Colectivo,Tipo de Incidencia,Hora/Fecha,Notas\n";

    for (let i = 0; i < filas.length; i++) {
        let celdas = filas[i].getElementsByTagName('td');
        if (celdas.length > 1) {
            csvContent += `"${celdas[1].innerText}","${celdas[2].innerText}","${celdas[3].innerText}","${celdas[4].innerText}","${celdas[5].innerText}"\n`;
        }
    }

    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "reporte_asistencia.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function procesarImportacionCSV(inputElement) {
    let archivo = inputElement.files[0];
    let feedback = document.getElementById('import-feedback');

    if (!archivo) return;

    if (feedback) feedback.innerHTML = '<span style="color:blue;">Leyendo archivo...</span>';

    let lector = new FileReader();

    lector.onload = async function (evento) {
        let contenido = evento.target.result;
        let lineas = contenido.split('\n');

        let incidenciasAImportar = [];

        for (let i = 1; i < lineas.length; i++) {
            let linea = lineas[i].trim();
            if (linea === '') continue;

            let valores = linea.replace(/^"|"$/g, '').split('","');

            if (valores.length >= 4) {
                incidenciasAImportar.push({
                    nombre: valores[0],
                    colectivo: valores[1],
                    tipo: valores[2],
                    hora: valores[3],
                    notas: valores[4] || ''
                });
            }
        }

        if (incidenciasAImportar.length === 0) {
            if (feedback) feedback.innerHTML = '<span style="color:red;">El archivo no vale o está vacío.</span>';
            return;
        }

        if (feedback) feedback.innerHTML = '<span style="color:blue;">Enviando registros a Odoo...</span>';

        try {
            let respuesta = await fetch(BASE_URL + '/api/importar_asistencia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
                body: JSON.stringify({ datos: incidenciasAImportar })
            });

            let json = await respuesta.json();

            let htmlErrores = '';
            if (json.errores && json.errores.length > 0) {
                htmlErrores = `
                    <div style="margin-top: 10px; padding: 10px; background-color: #fee2e2; border: 1px solid #f87171; border-radius: 5px; max-height: 120px; overflow-y: auto; text-align: left;">
                        <strong style="color: #991b1b; font-size: 0.85em;">Detalle de registros omitidos:</strong>
                        <ul style="color: #b91c1c; font-size: 0.8em; margin-top: 5px; padding-left: 20px;">
                            ${json.errores.map(err => `<li>${err}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            if (json.status === 'success' || json.status === 'exito') {
                if (feedback) {
                    let colorMensaje = json.errores.length > 0 ? '#ca8a04' : 'green'; 
                    feedback.innerHTML = `<span style="color:${colorMensaje}; font-weight:bold;">${json.mensaje}</span>` + htmlErrores;
                }
                cargarAsistencia();
            } else {
                if (feedback) {
                    feedback.innerHTML = `<span style="color:red; font-weight:bold;">Error: ${json.mensaje || 'Fallo al importar'}</span>` + htmlErrores;
                }
            }
            
        } catch (error) {
            if (feedback) feedback.innerHTML = '<span style="color:red;">Error de red al conectar con el servidor.</span>';
        }

        inputElement.value = '';
    };

    lector.readAsText(archivo);
}

async function borrarPersona(idPersona, tipoPersona) {
    if (!confirm(`¿Borrar a este ${tipoPersona}?`)) return;
    try {
        await fetch(`${BASE_URL}/api/borrar_persona`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify({ id: idPersona, tipo: tipoPersona })
        });
        tipoPersona === 'alumno' ? cargarAlumnado() : cargarProfesorado();
    } catch (error) {}
}

aplicarFiltroBusqueda('search-input', 'odoo-table-body');

window.addEventListener('DOMContentLoaded', () => { verificarSesionInicial(); });