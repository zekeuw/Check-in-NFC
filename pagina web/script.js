const BASE_URL = 'http://10.102.7.221:5000';
let miGraficoChartJs = null;

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

function formatCurso(clave) {
    if (CURSOS_MAP[clave]) return CURSOS_MAP[clave];
    return clave ? clave : '--';
}

function formatDept(clave) {
    if (DEPT_MAP[clave]) return DEPT_MAP[clave];
    return clave ? clave : 'Docente';
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

    if (botonClicado) botonClicado.classList.add('active');

    if (idSeccion === 'estadisticas') cargarDashboard();
    if (idSeccion === 'alumnado') cargarAlumnado();
    if (idSeccion === 'profesorado') cargarProfesorado();
    if (idSeccion === 'nfc') cargarSelectNFC();
    if (idSeccion === 'asistencia') cargarAsistencia();

    let menu = document.getElementById('sidebar');
    if(menu.classList.contains('show-menu')) {
        menu.classList.remove('show-menu');
    }
}

async function cargarDashboard() {
    try {
        let tipoSeleccionado = document.getElementById('filtro-dashboard-tipo').value;
        let respuesta = await fetch(BASE_URL + '/api/dashboard?tipo=' + tipoSeleccionado);
        let datos = await respuesta.json();

        let listaPersonas = datos.alumnos || datos.profesores || datos.data || [];
        let htmlTabla = '';

        for (let i = 0; i < listaPersonas.length; i++) {
            let persona = listaPersonas[i];
            let identificadorNfc = persona.nfc_id || persona.id_NFC;
            let nombrePersona = persona.name || persona.nombre;

            let subtitulo = persona.curso ? formatCurso(persona.curso) : formatDept(persona.departamento);

            htmlTabla += '<tr class="' + (identificadorNfc ? '' : 'alert-row') + '">';

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

        document.getElementById('stat-total-salidas').innerText = datos.stats?.total_hoy || '--';
        document.getElementById('stat-incidencias').innerText = datos.stats?.incidencias || '--';
        document.getElementById('current-date').innerText = datos.stats?.fecha || '--';

        let respuestaAsis = await fetch(BASE_URL + '/api/asistencia?filtro=' + tipoSeleccionado);
        let jsonAsistencia = await respuestaAsis.json();

        let conteoSemana = [0, 0, 0, 0, 0];
        let etiquetasDias = ['L', 'M', 'X', 'J', 'V'];

        if (jsonAsistencia.status === 'success') {
            let hoy = new Date();

            for (let i = 0; i < jsonAsistencia.data.length; i++) {
                let reg = jsonAsistencia.data[i];

                if (String(reg.tipo).toLowerCase().includes('salida')) {
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
        if (diaDeHoy >= 1 && diaDeHoy <= 5) {
            let salidasActivasHoy = datos.stats.total_hoy || 0;
            if (salidasActivasHoy > conteoSemana[diaDeHoy - 1]) {
                conteoSemana[diaDeHoy - 1] = salidasActivasHoy;
            }
        }

        const ctx = document.getElementById('odoo-chart').getContext('2d');

        if (miGraficoChartJs) {
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
                    borderSkipped: false,
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
                        ticks: { stepSize: 1, color: '#64748b' },
                        grid: { color: '#e2e8f0' }
                    },
                    x: {
                        ticks: { color: '#64748b' },
                        grid: { display: false }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error Dashboard:", error);
    }
}

async function cargarAlumnado() {
    let cuerpoTabla = document.getElementById('alumnado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/alumnado');
        let json = await respuesta.json();

        if (json.status === 'success') {
            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let alumno = json.data[i];
                let dniTexto = alumno.dni ? alumno.dni : '--';

                let etiquetaNfc = alumno.id_NFC ? '<span class="nfc-tag">' + alumno.id_NFC + '</span>' : '<span class="badge-error">PENDIENTE</span>';

                // Generar foto con iniciales
                const nombreParaAvatar = (alumno.nombre + '+' + (alumno.apellidos || '')).replace(/ /g, '+');
                const urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
                const imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

                let estaEnRecreo = alumno.recreo === true;
                let switchRecreo = `
                        <label class="switch">
                            <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'recreo', this.checked, 'alumno')" ${estaEnRecreo ? 'checked' : ''}>
                            <span class="slider recreo-slider"></span>
                        </label>
                    `;

                let haSalido = alumno.salida_anticipada === true;
                let switchSalida = `
                        <label class="switch">
                            <input type="checkbox" onchange="cambiarEstadoPersona(${alumno.id}, 'salida_anticipada', this.checked, 'alumno')" ${haSalido ? 'checked' : ''}>
                            <span class="slider salida-slider"></span>
                        </label>
                    `;

                htmlNuevo += '<tr>';
                htmlNuevo += `<td style="text-align:center;">${imagenHtml}</td>`;
                htmlNuevo += '<td><span class="user-name">' + alumno.nombre + ' ' + (alumno.apellidos || '') + '</span></td>';
                htmlNuevo += '<td><span class="user-meta" style="color:#000; font-weight:500;">' + formatCurso(alumno.curso) + '</span></td>';
                htmlNuevo += '<td>' + dniTexto + '</td>';
                htmlNuevo += '<td style="text-align:center;">' + etiquetaNfc + '</td>';
                htmlNuevo += '<td style="text-align:center; vertical-align:middle;">' + switchRecreo + '</td>';
                htmlNuevo += '<td style="text-align:center; vertical-align:middle;">' + switchSalida + '</td>';
                htmlNuevo += '</tr>';
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error de conexión</td></tr>';
    }
}

async function cambiarEstadoPersona(idPersona, campoCambiar, nuevoValor, tipoPersona) {
    try {
        let respuesta = await fetch(BASE_URL + '/api/actualizar_estado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            alert('No se pudo actualizar: ' + (json.mensaje || 'Error desconocido'));
            cargarAlumnado();
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión al intentar cambiar el estado.');
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

    if (nombre === '' || apellidos === '' || curso === '') {
        feedback.innerHTML = '<span style="color:red;">Nombre, Apellidos y Curso son obligatorios</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Registrando en Odoo...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, curso: curso,
        dni: dni, fecha_nacimiento: fecha, id_NFC: nfc, tipo: 'alumno'
    };

    try {
        let respuesta = await fetch(BASE_URL + '/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">Registrado correctamente</span>';
            document.getElementById('add-al-nombre').value = '';
            document.getElementById('add-al-apellidos').value = '';
            document.getElementById('add-al-dni').value = '';
            document.getElementById('add-al-nfc').value = '';
            cargarAlumnado();
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">Error de conexión con el Servidor</span>';
    }
}

async function cargarProfesorado() {
    let cuerpoTabla = document.getElementById('profesorado-body');
    try {
        let respuesta = await fetch(BASE_URL + '/api/profesorado');
        let json = await respuesta.json();

        if (json.status === 'success') {
            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let profe = json.data[i];
                let apellidoTexto = profe.apellidos ? profe.apellidos : '';
                let dniTexto = profe.dni ? profe.dni : '--';

                let etiquetaNfc = profe.id_NFC ? '<span class="nfc-tag">' + profe.id_NFC + '</span>' : '<span class="badge-error">PENDIENTE</span>';

                htmlNuevo += '<tr>';
                htmlNuevo += '<td><span class="user-name">' + profe.nombre + ' ' + apellidoTexto + '</span></td>';
                htmlNuevo += '<td><span class="user-meta" style="color:#000; font-weight:500;">' + formatDept(profe.departamento) + '</span></td>';
                htmlNuevo += '<td>' + dniTexto + '</td>';
                htmlNuevo += '<td style="text-align:center;">' + etiquetaNfc + '</td>';
                htmlNuevo += '</tr>';
            }
            cuerpoTabla.innerHTML = htmlNuevo;
        }
    } catch (error) {
        cuerpoTabla.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Error cargando profesores</td></tr>';
    }
}

async function crearProfesorDesdeWeb() {
    let nombre = document.getElementById('add-pr-nombre').value.trim();
    let apellidos = document.getElementById('add-pr-apellidos').value.trim();
    let departamento = document.getElementById('add-pr-departamento').value;
    let dni = document.getElementById('add-pr-dni').value.trim();
    let nfc = document.getElementById('add-pr-nfc').value.trim();
    let feedback = document.getElementById('add-pr-feedback');

    if (nombre === '' || departamento === '') {
        feedback.innerHTML = '<span style="color:red;">Nombre y Departamento son obligatorios</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Registrando en Odoo...</span>';

    let datosEnviados = {
        nombre: nombre, apellidos: apellidos, departamento: departamento,
        dni: dni, id_NFC: nfc, tipo: 'profesor'
    };

    try {
        let respuesta = await fetch(BASE_URL + '/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'exito' || json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">Profesor registrado correctamente</span>';
            document.getElementById('add-pr-nombre').value = '';
            document.getElementById('add-pr-apellidos').value = '';
            document.getElementById('add-pr-dni').value = '';
            document.getElementById('add-pr-nfc').value = '';
            cargarProfesorado();
        } else {
            feedback.innerHTML = '<span style="color:red;">Error: ' + json.mensaje + '</span>';
        }
    } catch (error) {
        feedback.innerHTML = '<span style="color:red;">Error de conexión con el Servidor</span>';
    }
}

async function cargarAsistencia() {
    let cuerpoTabla = document.getElementById('asistencia-body');
    let filtroSeleccionado = document.getElementById('filtro-asistencia').value;
    let fechaSeleccionada = document.getElementById('filtro-fecha-asistencia').value;

    cuerpoTabla.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando datos desde Odoo...</td></tr>';

    try {
        let url = BASE_URL + '/api/asistencia?filtro=' + filtroSeleccionado;
        if(fechaSeleccionada) {
            url += '&fecha=' + fechaSeleccionada;
        }

        let respuesta = await fetch(url);
        let json = await respuesta.json();

        if (json.status === 'success') {
            if (json.data.length === 0) {
                cuerpoTabla.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay incidencias registradas.</td></tr>';
                return;
            }

            let htmlNuevo = '';
            for (let i = 0; i < json.data.length; i++) {
                let registro = json.data[i];

                // Generar foto con iniciales
                const nombreParaAvatar = registro.nombre.replace(/ /g, '+');
                const urlAvatar = `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=random&color=fff&size=128`;
                const imagenHtml = `<img src="${urlAvatar}" class="avatar-img">`;

                let estiloBadge = "background:#f1f5f9; color:#475569; border: 1px solid #e2e8f0;";
                let textoIncidencia = registro.tipo;

                if (String(registro.tipo).toLowerCase().includes('tarde')) {
                    estiloBadge = "background:#fef08a; color:#854d0e; border: 1px solid #fde047;";
                    textoIncidencia = "Llegada Tarde";
                } else if (String(registro.tipo).toLowerCase().includes('salida')) {
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
        cuerpoTabla.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Error de conexión.</td></tr>';
    }
}

async function cargarSelectNFC() {
    let tipoSeleccionado = document.getElementById('select-tipo-nfc').value;
    let desplegable = document.getElementById('select-persona-nfc');
    desplegable.innerHTML = '<option value="">Cargando lista...</option>';

    try {
        let ruta = tipoSeleccionado === 'alumnos' ? '/api/alumnado' : '/api/profesorado';
        let respuesta = await fetch(BASE_URL + ruta);
        let json = await respuesta.json();

        if (json.status === 'success') {
            let opcionesHtml = '<option value="">-- Selecciona una persona --</option>';
            for (let i = 0; i < json.data.length; i++) {
                let persona = json.data[i];
                let subtitulo = tipoSeleccionado === 'alumnos' ? formatCurso(persona.curso) : formatDept(persona.departamento);
                let apellidos = persona.apellidos ? persona.apellidos : '';
                let nombreCompleto = persona.nombre + ' ' + apellidos;

                opcionesHtml += '<option value="' + persona.id + '">' + nombreCompleto + ' - ' + subtitulo + '</option>';
            }
            desplegable.innerHTML = opcionesHtml;
        }
    } catch (error) {
        console.error(error);
        desplegable.innerHTML = '<option value="">Error cargando datos</option>';
    }
}

async function guardarVinculacion() {
    let tipo = document.getElementById('select-tipo-nfc').value;
    let idPersona = document.getElementById('select-persona-nfc').value;
    let codigoNfc = document.getElementById('input-nfc-code').value;
    let feedback = document.getElementById('nfc-feedback');

    if (idPersona === '' || codigoNfc === '') {
        feedback.innerHTML = '<span style="color:red;">Faltan datos por rellenar</span>';
        return;
    }

    feedback.innerHTML = '<span style="color:blue;">Enviando a Odoo...</span>';
    let datosEnviados = { id: parseInt(idPersona), nfc: codigoNfc, tipo: tipo };

    try {
        let respuesta = await fetch(BASE_URL + '/api/vincular_nfc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosEnviados)
        });
        let json = await respuesta.json();

        if (json.status === 'success') {
            feedback.innerHTML = '<span style="color:green;">¡Vinculado correctamente!</span>';
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
    document.getElementById(inputId).addEventListener('input', function (evento) {
        let textoBuscado = evento.target.value.toLowerCase();
        let filas = document.querySelectorAll('#' + tableBodyId + ' tr');

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

// --- NUEVA FUNCIÓN PARA EXPORTAR A CSV ---
function exportarCSV(tableBodyId) {
    let filas = document.querySelectorAll('#' + tableBodyId + ' tr');
    
    // Si no hay datos o solo está el texto de "Cargando..."
    if (filas.length === 0 || (filas.length === 1 && filas[0].innerText.includes('Cargando'))) {
        alert("No hay datos para exportar.");
        return;
    }

    // Cabeceras del CSV
    let csvContent = "Nombre,Colectivo,Tipo de Incidencia,Hora/Fecha,Notas\n";

    for (let i = 0; i < filas.length; i++) {
        let celdas = filas[i].querySelectorAll('td');
        
        if (celdas.length > 1) { 
            // Omitimos la celda [0] porque es la FOTO.
            // Limpiamos comas para no romper el formato CSV.
            let nombre = celdas[1].innerText.replace(/,/g, ''); 
            let colectivo = celdas[2].innerText.replace(/,/g, '');
            let incidencia = celdas[3].innerText.replace(/,/g, '');
            let hora = celdas[4].innerText.replace(/,/g, '');
            let notas = celdas[5].innerText.replace(/,/g, '');

            csvContent += `${nombre},${colectivo},${incidencia},${hora},${notas}\n`;
        }
    }

    // Crear el archivo al vuelo y forzar la descarga
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reporte_asistencia.csv");
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

aplicarFiltroBusqueda('search-input', 'odoo-table-body');
aplicarFiltroBusqueda('search-alumnado', 'alumnado-body');
aplicarFiltroBusqueda('search-profesorado', 'profesorado-body');

document.getElementById('input-nfc-code').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        guardarVinculacion();
    }
});

cargarDashboard();
setInterval(cargarDashboard, 15000);