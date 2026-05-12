// --- VARIABLES GLOBALES Y CONFIGURACIÓN ---
let BASE_URL = localStorage.getItem('sjr_base_url') || 'http://10.102.7.221:5000';
let API_KEY = localStorage.getItem('sjr_api_key') || 'kartu_prosim';
let miGraficoChartJs = null;
let intervalDashboard = null;

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
    
    // Login simulado (puedes conectarlo a un endpoint si lo necesitas)
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
    
    // Detener peticiones en segundo plano
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
    
    // Refrescar cada 15 segundos
    intervalDashboard = setInterval(() => {
        if (!document.hidden) cargarDashboard();
    }, 15000);
}

// --- VISIBILIDAD DE CONTRASEÑAS (NUEVO) ---
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
    if (CURSOS_MAP[clave]) {
        return CURSOS_MAP[clave];
    } else if (clave) {
        return clave;
    } else {
        return '--';
    }
}

function formatDept(clave) {
    if (DEPT_MAP[clave]) {
        return DEPT_MAP[clave];
    } else if (clave) {
        return clave;
    } else {
        return 'Docente';
    }
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
    let textoDashboard = document.getElementById('stat-sync-percent');

    contenedoresSubtitulo.forEach(contenedor => {
        if (estaConectado) {
            contenedor.innerHTML = '<span id="sync-status" class="status-dot" style="background-color: #10b981;"></span> Conectado a Odoo';
        } else {
            contenedor.innerHTML = '<span id="sync-status" class="status-dot" style="background-color: #ef4444;"></span> Desconectado';
        }
    });

    if (textoDashboard) {
        if (estaConectado) {
            textoDashboard.innerText = 'OK';
            textoDashboard.style.color = '#10b981';
        } else {
            textoDashboard.innerText = 'ERROR';
            textoDashboard.style.color = '#ef4444';
        }
    }
}

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
        if (datos.alumnos) {
            listaPersonas = datos.alumnos;
        } else if (datos.profesores) {
            listaPersonas = datos.profesores;
        } else if (datos.data) {
            listaPersonas = datos.data;
        }
        
        let htmlTabla = '';

        for (let i = 0; i < listaPersonas.length; i++) {
            let persona = listaPersonas[i];
            let identificadorNfc = persona.nfc_id || persona.id_NFC;
            let nombrePersona = persona.name || persona.nombre;

            let subtitulo = persona.curso ? formatCurso(persona.curso) : formatDept(persona.departamento);

            if (identificadorNfc) {
                htmlTabla += '<tr>';
            } else {
                htmlTabla += '<tr class="alert-row">';
            }

            htmlTabla += '<td>';
            htmlTabla += '<div class="user-info">';
            htmlTabla += '<span class="user-name">' + nombrePersona + '</span>';
            htmlTabla += '<span class="user-meta">' + subtitulo + '</span>';
            htmlTabla += '</div></td>';

            htmlTabla += '<td>';
            if (identificadorNfc) {
                htmlTabla += '<span class="nfc-tag">' + identificadorNfc + '</span>';
            } else {
                htmlTabla += '<span class="badge-error">SIN TAG</span>';
            }
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

        if (datos.stats) {
            document.getElementById('stat-total-salidas').innerText = datos.stats.total_hoy || '--';
            document.getElementById('stat-incidencias').innerText = datos.stats.incidencias || '--';
            document.getElementById('current-date').innerText = datos.stats.fecha || '--';
        }

        let respuestaAsis = await fetch(BASE_URL + '/api/asistencia?filtro=' + tipoSeleccionado, {headers: {"x-api-key": API_KEY}});
        let jsonAsistencia = await respuestaAsis.json();

        let conteoSemana = [0, 0, 0, 0, 0];
        let etiquetasDias = ['L', 'M', 'X', 'J', 'V'];

        if (jsonAsistencia.status === 'success') {
            let hoy = new Date();

            for (let i = 0; i < jsonAsistencia.data.length; i++) {
                let reg = jsonAsistencia.data[i];
                let textoTipo = String(reg.tipo).toLowerCase();

                if (textoTipo.includes('salida')) {
                    let fechaSola = reg.hora.split(' ')[0];
                    let partesFecha = fechaSola.split('/');

                    if (partesFecha.length === 3) {
                        let fechaRegistro = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
                        let diferenciaTiempo = hoy.getTime() - fechaRegistro.getTime();
                        let diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

                        if (diferenciaDias <= 7) {
                            let diaSemana = fechaRegistro.getDay();
                            if (diaSemana >= 1 && diaSemana <= 5) {
                                conteoSemana[diaSemana - 1]++;
                            }
                        }
                    }
                }
            }
        }

        let diaDeHoy = new Date().getDay();
        if (diaDeHoy >= 1 && diaDeHoy <= 5 && datos.stats) {
            let salidasActivasHoy = datos.stats.total_hoy || 0;
            if (salidasActivasHoy > conteoSemana[diaDeHoy - 1]) {
                conteoSemana[diaDeHoy - 1] = salidasActivasHoy;
            }
        }

        const ctx = document.getElementById('odoo-chart').getContext('2d');

        if (miGraficoChartJs !== null) {
            miGraficoChartJs.destroy();
        }

        miGraficoChartJs = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetasDias,
                datasets: [{
                    label: 'Salidas Anticipadas',
                    data: conteoSemana,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    barThickness: 30
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
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

async function cargarAlumnado() {
    let cuerpoTabla = document.getElementById('alumnado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/alumnado', {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let alumno = json.data[i];
                let dniTexto = alumno.dni ? alumno.dni : '--';

                let etiquetaNfc = '<span class="badge-error">PENDIENTE</span>';
                if (alumno.id_NFC) {
                    etiquetaNfc = '<span class="nfc-tag">' + alumno.id_NFC + '</span>';
                }

                let nombreParaAvatar = alumno.nombre + '+' + (alumno.apellidos || '');
                nombreParaAvatar = nombreParaAvatar.split(' ').join('+');
                let urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
                let imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

                let checkRecreo = '';
                if (alumno.recreo === true) {
                    checkRecreo = 'checked';
                }
                
                let switchRecreo = `
                        <label class="switch">
                            <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'recreo', this.checked, 'alumno')" ${checkRecreo}>
                            <span class="slider recreo-slider"></span>
                        </label>
                    `;

                let checkSalida = '';
                if (alumno.salida_anticipada === true) {
                    checkSalida = 'checked';
                }

                let switchSalida = `
                        <label class="switch">
                            <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'salida_anticipada', this.checked, 'alumno')" ${checkSalida}>
                            <span class="slider salida-slider"></span>
                        </label>
                    `;

                htmlNuevo += '<tr>';
                htmlNuevo += '<td style="text-align:center;">' + imagenHtml + '</td>';
                htmlNuevo += '<td><span class="user-name">' + alumno.nombre + ' ' + (alumno.apellidos || '') + '</span></td>';
                htmlNuevo += '<td><span class="user-meta" style="color:#000; font-weight:500;">' + formatCurso(alumno.curso) + '</span></td>';
                htmlNuevo += '<td>' + dniTexto + '</td>';
                htmlNuevo += '<td style="text-align:center;">' + etiquetaNfc + '</td>';
                htmlNuevo += '<td style="text-align:center; vertical-align:middle;">' + switchRecreo + '</td>';
                htmlNuevo += '<td style="text-align:center; vertical-align:middle;">' + switchSalida + '</td>';
                
                let btnBorrarAl = `<button class="btn-borrar" onclick="borrarPersona(${alumno.id}, 'alumno')" title="Dar de baja">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>`;
                htmlNuevo += `<td style="text-align:center; vertical-align:middle;">${btnBorrarAl}</td>`;
                
                htmlNuevo += '</tr>';
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        }
    } catch (error) {
        console.error(error);
        cuerpoTabla.innerHTML = '<tr><td colspan="8" style="color:red; text-align:center;">Error de conexión</td></tr>';
    }
}

async function cambiarEstadoPersona(idPersona, campoCambiar, nuevoValor, tipoPersona) {
    try {
        let respuesta = await fetch(BASE_URL + '/api/actualizar_estado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify({
                id: idPersona,
                tipo: tipoPersona,
                campo: campoCambiar,
                valor: nuevoValor
            })
        });

        let json = await respuesta.json();

        if (json.status === 'success' || json.status === 'exito') {
            cargarDashboard();
        } else {
            alert('No se pudo actualizar el estado.');
            cargarAlumnado();
        }
    } catch (error) {
        console.error(error);
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

    if (/\d/.test(nombre)) {
        feedback.innerHTML = '<span style="color:red;">⚠ El nombre no puede contener números</span>';
        return;
    }

    if (/\d/.test(apellidos)) {
        feedback.innerHTML = '<span style="color:red;">⚠ Los apellidos no pueden contener números</span>';
        return;
    }

    if (dni !== '') {
        let dniPattern = /^\d{8}[A-Z]$/i;
        if (!dniPattern.test(dni)) {
            feedback.innerHTML = '<span style="color:red;">⚠ El DNI debe tener 8 dígitos y 1 letra (ej: 12345678A)</span>';
            return;
        }
    }

    let fechaNac = new Date(fecha);
    let hoy = new Date();
    if (fechaNac > hoy) {
        feedback.innerHTML = '<span style="color:red;">⚠ La fecha de nacimiento no puede ser futura</span>';
        return;
    }

    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    if (edad < 10 || edad > 80) {
        feedback.innerHTML = '<span style="color:red;">⚠ La edad debe estar entre 10 y 80 años</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando datos...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, curso: curso,
        dni: dni, fecha_nacimiento: fecha, id_NFC: nfc, tipo: 'alumno'
    };

    try {
        let respuesta = await fetch(BASE_URL + '/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">Alumno guardado correctamente. Redirigiendo...</span>';
            document.getElementById('add-al-nombre').value = '';
            document.getElementById('add-al-apellidos').value = '';
            document.getElementById('add-al-dni').value = '';
            document.getElementById('add-al-nfc').value = '';
            
            setTimeout(() => {
                cargarAlumnado();
                cambiarSeccion('alumnado', document.querySelectorAll('.nav-btn')[1]);
            }, 1500);
            
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">No se puede conectar al servidor</span>';
    }
}

async function cargarProfesorado() {
    let cuerpoTabla = document.getElementById('profesorado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/profesorado', {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let profe = json.data[i];
                let apellidoTexto = profe.apellidos ? profe.apellidos : '';
                let dniTexto = profe.dni ? profe.dni : '--';

                let etiquetaNfc = '<span class="badge-error">PENDIENTE</span>';
                if (profe.id_NFC) {
                    etiquetaNfc = '<span class="nfc-tag">' + profe.id_NFC + '</span>';
                }

                htmlNuevo += '<tr>';
                htmlNuevo += '<td><span class="user-name">' + profe.nombre + ' ' + apellidoTexto + '</span></td>';
                htmlNuevo += '<td><span class="user-meta" style="color:#000; font-weight:500;">' + formatDept(profe.departamento) + '</span></td>';
                htmlNuevo += '<td>' + dniTexto + '</td>';
                htmlNuevo += '<td style="text-align:center;">' + etiquetaNfc + '</td>';
                
                let btnBorrarPr = `<button class="btn-borrar" onclick="borrarPersona(${profe.id}, 'profesor')" title="Dar de baja">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>`;
                htmlNuevo += `<td style="text-align:center;">${btnBorrarPr}</td>`;
                
                htmlNuevo += '</tr>';
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error cargando profesores</td></tr>';
    }
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

    if (/\d/.test(nombre)) {
        feedback.innerHTML = '<span style="color:red;">⚠ El nombre no puede contener números</span>';
        return;
    }

    if (/\d/.test(apellidos)) {
        feedback.innerHTML = '<span style="color:red;">⚠ Los apellidos no pueden contener números</span>';
        return;
    }

    if (dni !== '') {
        let dniPattern = /^\d{8}[A-Z]$/i;
        if (!dniPattern.test(dni)) {
            feedback.innerHTML = '<span style="color:red;">⚠ El DNI debe tener 8 dígitos y 1 letra (ej: 12345678A)</span>';
            return;
        }
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando datos...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, departamento: departamento,
        dni: dni, id_NFC: nfc, tipo: 'profesor'
    };

    try {
        let respuesta = await fetch(BASE_URL + '/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">Profesor guardado correctamente. Redirigiendo...</span>';
            document.getElementById('add-pr-nombre').value = '';
            document.getElementById('add-pr-apellidos').value = '';
            document.getElementById('add-pr-dni').value = '';
            document.getElementById('add-pr-nfc').value = '';
            
            setTimeout(() => {
                cargarProfesorado();
                cambiarSeccion('profesorado', document.querySelectorAll('.nav-btn')[2]);
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
        if (fechaSeleccionada) {
            url += '&fecha=' + fechaSeleccionada;
        }

        let respuesta = await fetch(url, {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            if (json.data.length === 0) {
                cuerpoTabla.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay nada que mostrar.</td></tr>';
                return;
            }

            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let registro = json.data[i];

                let nombreParaAvatar = registro.nombre.split(' ').join('+');
                let urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
                let imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

                let estiloBadge = "background:#f1f5f9; color:#475569; border: 1px solid #e2e8f0;";
                let textoIncidencia = registro.tipo;

                let tipoTexto = String(registro.tipo).toLowerCase();

                if (tipoTexto.indexOf('tarde') !== -1) {
                    estiloBadge = "background:#fef08a; color:#854d0e; border: 1px solid #fde047;";
                    textoIncidencia = "Llegada Tarde";
                } else if (tipoTexto.indexOf('salida') !== -1) {
                    estiloBadge = "background:#fed7aa; color:#9a3412; border: 1px solid #fdba74;";
                    textoIncidencia = "Salida Anticipada";
                }

                let notasTexto = registro.notas ? registro.notas : '--';

                htmlNuevo += '<tr>';
                htmlNuevo += `<td style="text-align:center;">${imagenHtml}</td>`;
                htmlNuevo += '<td><span class="user-name">' + registro.nombre + '</span></td>';
                htmlNuevo += '<td><span class="user-meta" style="text-transform: capitalize;">' + registro.colectivo + '</span></td>';
                htmlNuevo += '<td><span class="badge-error" style="' + estiloBadge + '">' + textoIncidencia + '</span></td>';
                htmlNuevo += '<td><strong>' + registro.hora + '</strong></td>';
                htmlNuevo += '<td><span style="color:#64748b; font-size:0.85rem;">' + notasTexto + '</span></td>';
                htmlNuevo += '</tr>';
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        } else {
            cuerpoTabla.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Error: ' + json.mensaje + '</td></tr>';
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Error de red.</td></tr>';
    }
}

async function cargarSelectNFC() {
    let tipoSeleccionado = document.getElementById('select-tipo-nfc').value;
    let desplegable = document.getElementById('select-persona-nfc');
    desplegable.innerHTML = '<option value="">Cargando lista...</option>';

    try {
        let ruta = '/api/alumnado';
        if (tipoSeleccionado === 'profesores') {
            ruta = '/api/profesorado';
        }

        let respuesta = await fetch(BASE_URL + ruta, {headers: {"x-api-key": API_KEY}});
        let json = await respuesta.json();

        if (json.status === 'success') {
            let opcionesHtml = '<option value="">-- Selecciona --</option>';
            for (let i = 0; i < json.data.length; i++) {
                let persona = json.data[i];
                let subtitulo = '';
                if (tipoSeleccionado === 'alumnos') {
                    subtitulo = formatCurso(persona.curso);
                } else {
                    subtitulo = formatDept(persona.departamento);
                }
                
                let apellidos = persona.apellidos ? persona.apellidos : '';
                let nombreCompleto = persona.nombre + ' ' + apellidos;

                opcionesHtml += '<option value="' + persona.id + '">' + nombreCompleto + ' - ' + subtitulo + '</option>';
            }
            desplegable.innerHTML = opcionesHtml;
        }
    } catch (error) {
        console.error(error);
        desplegable.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function guardarVinculacion() {
    let tipo = document.getElementById('select-tipo-nfc').value;
    let idPersona = document.getElementById('select-persona-nfc').value;
    let codigoNfc = document.getElementById('input-nfc-code').value;
    let feedback = document.getElementById('nfc-feedback');

    if (idPersona === '' || codigoNfc === '') {
        feedback.innerHTML = '<span style="color:red;">Rellena todos los campos</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando a Odoo...</span>';
    let datosEnviados = { id: parseInt(idPersona), nfc: codigoNfc, tipo: tipo };

    try {
        let respuesta = await fetch(BASE_URL + '/api/vincular_nfc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "x-api-key": API_KEY },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">¡Vinculado bien!</span>';
            document.getElementById('input-nfc-code').value = '';
            document.getElementById('console-log').innerHTML += '<br>> Asignado ' + codigoNfc + ' a ID ' + idPersona + ' (' + tipo + ')';
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">Error de conexión</span>';
    }
}

function aplicarFiltroBusqueda(inputId, tableBodyId) {
    let input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('input', function (evento) {
            let textoBuscado = evento.target.value.toLowerCase();
            let filas = document.getElementById(tableBodyId).getElementsByTagName('tr');

            for (let i = 0; i < filas.length; i++) {
                let textoFila = filas[i].innerText.toLowerCase();
                if (textoFila.includes(textoBuscado)) {
                    filas[i].style.display = '';
                } else {
                    filas[i].style.display = 'none';
                }
            }
        });
    }
}

function exportarCSV(tableBodyId) {
    let filas = document.getElementById(tableBodyId).getElementsByTagName('tr');

    if (filas.length === 0 || (filas.length === 1 && filas[0].innerText.includes('Cargando'))) {
        alert("No hay datos para exportar.");
        return;
    }

    let csvContent = "Nombre,Colectivo,Tipo de Incidencia,Hora/Fecha,Notas\n";

    for (let i = 0; i < filas.length; i++) {
        let celdas = filas[i].getElementsByTagName('td');

        if (celdas.length > 1) {
            let nombre = celdas[1].innerText;
            let colectivo = celdas[2].innerText;
            let incidencia = celdas[3].innerText;
            let hora = celdas[4].innerText;
            let notas = celdas[5].innerText;

            csvContent += `"${nombre}","${colectivo}","${incidencia}","${hora}","${notas}"\n`;
        }
    }

    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
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
    let confirmacion = confirm(`¿Estás seguro de que deseas dar de baja a este ${tipoPersona}? Esta acción no se puede deshacer y borrará sus vínculos NFC.`);
    
    if (!confirmacion) return;

    try {
        let respuesta = await fetch(`${BASE_URL}/api/borrar_persona`, {
            method: 'DELETE', 
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                id: idPersona,
                tipo: tipoPersona
            })
        });

        let json = await respuesta.json();

        if (json.status === 'success' || json.status === 'exito') {
            if (tipoPersona === 'alumno') {
                cargarAlumnado();
            } else {
                cargarProfesorado();
            }
            cargarDashboard();
        } else {
            alert(`No se pudo dar de baja: ${json.mensaje}`);
        }
    } catch (error) {
        console.error(error);
        alert('Error de red al intentar borrar la persona.');
    }
}

// Eventos y Configuración Inicial de la UI
aplicarFiltroBusqueda('search-input', 'odoo-table-body');
aplicarFiltroBusqueda('search-alumnado', 'alumnado-body');
aplicarFiltroBusqueda('search-profesorado', 'profesorado-body');

document.getElementById('input-nfc-code').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        guardarVinculacion();
    }
});

// Arranca validando si el usuario ya hizo login
window.addEventListener('DOMContentLoaded', () => {
    verificarSesionInicial();
});