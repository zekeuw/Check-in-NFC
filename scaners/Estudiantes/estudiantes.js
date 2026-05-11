const API_URL = 'http://localhost:5000/AsistenciaEstudiante';

let operacionActual = '';
let esperandoNFC = false;
let bufferTeclado = '';
let timeoutReinicio;

const pantalla = document.getElementById('pantalla-status');

const reiniciarConsola = () => {
  esperandoNFC = false;
  bufferTeclado = '';
  pantalla.style.color = 'var(--console-text)';
  pantalla.style.borderLeftColor = 'var(--console-text)';
  pantalla.innerHTML = '> Sistema listo para operar.<br>> Paso 1: Selecciona Entrada o Salida.<br>> Paso 2: Escanea tu tarjeta NFC.';
};

const enviarFichaje = async (nfcId) => {
  esperandoNFC = false;
  clearTimeout(timeoutReinicio);

  pantalla.innerHTML = `> Validando tarjeta [${nfcId}] en Odoo...`;
  pantalla.style.color = '#ffffff';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': "kartu prosím"},
      body: JSON.stringify({
        id_NFC: nfcId,
        estado_asistencia: operacionActual,
      }),
    });

    const res = await response.json();

    if (response.ok) {
      pantalla.style.borderLeftColor = 'var(--success)';
      pantalla.style.color = 'var(--success)';
      pantalla.innerHTML = `> ¡ACCESO CORRECTO!<br>> <strong style="color: white; font-size: 1.1rem; display: block; margin-top: 5px;">${res.mensaje}</strong>`;
    } else {
      pantalla.style.borderLeftColor = 'var(--danger)';
      pantalla.style.color = '#fb7185';
      pantalla.innerHTML = `> ACCESO DENEGADO<br>> ${res.mensaje || 'Error en el sistema'}`;
    }
  } catch (err) {
    pantalla.style.borderLeftColor = 'var(--danger)';
    pantalla.style.color = '#fb7185';
    pantalla.innerHTML = '> ERROR DE RED: No se pudo conectar con el servidor.';
  }

  timeoutReinicio = setTimeout(reiniciarConsola, 4000);
};

window.seleccionarOperacion = (tipo) => {
  clearTimeout(timeoutReinicio);

  operacionActual = tipo;
  esperandoNFC = true;
  bufferTeclado = '';

  const textoVisible = tipo === 'llegada_tarde' ? 'ENTRADA' : 'SALIDA';

  pantalla.style.borderLeftColor = 'var(--warning)';
  pantalla.innerHTML = `> OPERACIÓN: <strong style="color:white;">${textoVisible}</strong><br>> <span style="color:var(--warning);">ACERCA TU TARJETA AL LECTOR AHORA...</span>`;

  timeoutReinicio = setTimeout(reiniciarConsola, 15000);
};

document.addEventListener('keydown', (e) => {
  if (!esperandoNFC) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (bufferTeclado.trim() !== '') {
      enviarFichaje(bufferTeclado.trim());
      bufferTeclado = '';
    }
  } else if (e.key.length === 1) {
    bufferTeclado += e.key;
  }
});
