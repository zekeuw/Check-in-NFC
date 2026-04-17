var urlApi = "http://localhost:5000/AsistenciaProfesor";

var operacionActiva = "";
var escuchandoTeclado = false;
var textoLeido = ""; 
var timerReinicio;

var pantalla = document.getElementById('pantalla-nfc');

function prepararFichaje(accion) {
    clearTimeout(timerReinicio);
    
    operacionActiva = accion;
    escuchandoTeclado = true;
    textoLeido = "";
    
    var mensaje = accion === 'llego al centro' ? 'ENTRADA' : 'SALIDA';

    pantalla.style.color = "#38bdf8";
    pantalla.innerHTML = "> OPERACIÓN: <strong>" + mensaje + "</strong><br>> Acerque su tarjeta al lector NFC ahora...";
    
    timerReinicio = setTimeout(limpiarPantalla, 10000);
}

document.addEventListener('keydown', function(evento) {
    if (escuchandoTeclado === false) return;

    if (evento.key === 'Enter') {
        evento.preventDefault();
        if (textoLeido.trim() !== "") {
            enviarDatosOdoo(textoLeido.trim());
            textoLeido = "";
        }
    } else if (evento.key.length === 1) {
        textoLeido += evento.key;
    }
});

async function enviarDatosOdoo(codigoTarjeta) {
    escuchandoTeclado = false;
    clearTimeout(timerReinicio);
    
    pantalla.innerHTML = "> Validando tarjeta: " + codigoTarjeta + "...";
    pantalla.style.color = "#ffffff";

    var datosParaEnviar = {
        id_NFC: codigoTarjeta,
        estado_asistencia: operacionActiva
    };

    try {
        var peticion = await fetch(urlApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosParaEnviar)
        });
        
        var respuesta = await peticion.json();

        if (peticion.ok && (respuesta.status === 'success' || respuesta.status === 'exito')) {
            pantalla.style.color = "#10b981";
            pantalla.innerHTML = "> ¡CORRECTO!<br>> " + respuesta.mensaje;
        } else {
            pantalla.style.color = "#f87171";
            pantalla.innerHTML = "> ERROR:<br>> " + (respuesta.mensaje || "La tarjeta no existe");
        }
    } catch (error) {
        pantalla.style.color = "#f87171";
        pantalla.innerHTML = "> ERROR DE RED:<br>> No se pudo contactar con el servidor Flask.";
    }

    timerReinicio = setTimeout(limpiarPantalla, 3000);
}

function limpiarPantalla() {
    escuchandoTeclado = false;
    operacionActiva = "";
    textoLeido = "";
    pantalla.style.color = "#38bdf8";
    pantalla.innerHTML = "> Sistema listo.<br>> Esperando selección de operación...";
}