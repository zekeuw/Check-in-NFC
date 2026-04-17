const API_URL = "http://localhost:5000/AsistenciaEstudiante";

let operacionActual = "";
let esperandoNFC = false;
let bufferTeclado = ""; 
let timeoutReinicio;

const pantalla = document.getElementById('pantalla-status');

function seleccionarOperacion(tipo) {
    clearTimeout(timeoutReinicio);
    
    operacionActual = tipo;
    esperandoNFC = true;
    bufferTeclado = "";

    let textoVisible = tipo === 'llegada_tarde' ? 'ENTRADA' : 'SALIDA';

    pantalla.style.borderColor = "#f59e0b";
    pantalla.innerHTML = "> OPERACIÓN: <strong style='color:white;'>" + textoVisible + "</strong><br>> <span style='color:#f59e0b;'>ACERCA TU TARJETA AL LECTOR...</span>";
    
    timeoutReinicio = setTimeout(reiniciarConsola, 15000);
}

document.addEventListener('keydown', function(e) {
    if (!esperandoNFC) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        if (bufferTeclado.trim() !== "") {
            enviarFichaje(bufferTeclado.trim());
            bufferTeclado = "";
        }
    } else if (e.key.length === 1) {
        bufferTeclado += e.key;
    }
});

async function enviarFichaje(nfcId) {
    esperandoNFC = false;
    clearTimeout(timeoutReinicio);
    
    pantalla.innerHTML = "> Validando tarjeta [" + nfcId + "] en Odoo...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_NFC: nfcId,
                estado_asistencia: operacionActual
            })
        });

        const res = await response.json();

        if (response.ok) {
            pantalla.style.borderColor = "#10b981";
            pantalla.style.color = "#10b981";
            
            pantalla.innerHTML = "> ¡ACCESO CORRECTO!<br>> <strong style='color: white; font-size: 1.2rem; display: block; margin-top: 5px;'>" + res.mensaje + "</strong>";
        } else {
            pantalla.style.borderColor = "#e11d48";
            pantalla.style.color = "#fb7185";
            pantalla.innerHTML = "> ACCESO DENEGADO<br>> " + (res.mensaje || "Error en el sistema");
        }
    } catch (err) {
        pantalla.style.color = "#fb7185";
        pantalla.innerHTML = "> ERROR DE RED: No se pudo conectar con el servidor.";
    }

    timeoutReinicio = setTimeout(reiniciarConsola, 4000);
}

function reiniciarConsola() {
    esperandoNFC = false;
    bufferTeclado = "";
    pantalla.style.color = "#38bdf8";
    pantalla.style.borderColor = "#38bdf8";
    pantalla.innerHTML = "> Sistema listo para operar.<br>> Paso 1: Selecciona Entrada o Salida.<br>> Paso 2: Escanea tu tarjeta NFC.";
}