# Guía de Usuario — Sistema de Control de Acceso NFC (IES)

## Índice
1. [Descripción general](#1-descripción-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Requisitos previos](#3-requisitos-previos)
4. [Puesta en marcha](#4-puesta-en-marcha)
5. [Panel de Jefatura de Estudios (Web)](#5-panel-de-jefatura-de-estudios-web)
6. [Terminales de fichaje NFC (Escáneres web)](#6-terminales-de-fichaje-nfc-escáneres-web)
7. [Aplicación móvil Android](#7-aplicación-móvil-android)
8. [API Backend — referencia rápida](#8-api-backend--referencia-rápida)
9. [Gestión de errores frecuentes](#9-gestión-de-errores-frecuentes)

---

## 1. Descripción general

El sistema permite controlar el acceso y registrar la asistencia de **alumnos y profesores** de un instituto de educación secundaria (IES) mediante tarjetas NFC.

Flujo principal:
```
Tarjeta NFC  →  Lector / App móvil  →  Backend Flask  →  Odoo (base de datos)
                                                        ↓
                                            Panel web Jefatura
```

Funciones principales:
- Registro de **entrada/salida** de alumnos y profesores mediante NFC.
- Gestión de **permisos de salida anticipada** y **permisos de recreo**.
- Panel web de administración para Jefatura de Estudios (estadísticas, alumnado, profesorado, asistencia).
- App Android para que los profesores inicien sesión y registren la asistencia de sus alumnos.
- Importación de registros de asistencia desde **CSV**.

---

## 2. Arquitectura del sistema

| Componente | Tecnología | Ubicación |
|---|---|---|
| Base de datos / ERP | Odoo 16+ (Docker) | `odoo/` |
| Backend / API REST | Python · Flask | `backend/app.py` |
| Panel Jefatura | HTML · CSS · JS | `pagina web/Jefatura de estudios/` |
| Terminal alumnos | HTML · CSS · JS | `scaners/Estudiantes/` |
| Terminal profesores | HTML · CSS · JS | `scaners/Profesores/` |
| App móvil | Android · Kotlin | `movil/ProyectoFinalCiclo/` |

---

## 3. Requisitos previos

### Servidor
- Docker y Docker Compose instalados.
- Python 3.10+ con las librerías `flask` y `flask-cors`.
- Puerto **8072** libre para Odoo y **5000** libre para el backend.

### Terminales de fichaje
- Navegador web moderno (Chrome / Firefox).
- Lector NFC conectado por USB que emule teclado (modo HID).

### App móvil
- Android 8.0 (API 26) o superior.
- NFC activado en el dispositivo.
- Servidor backend accesible desde la red del móvil.

---

## 4. Puesta en marcha

### 4.1 Arrancar Odoo

```bash
cd odoo/
docker-compose up -d
```

Odoo quedará disponible en `http://localhost:8072`.  
Base de datos configurada: **`Servidor_proyecto`** | Usuario: `admin` | Contraseña: `admin`.

> Si usas un nombre de base de datos o credenciales distintas, cámbialas en las primeras líneas de `backend/app.py`:
> ```python
> URL = 'http://localhost:8072'
> DB  = 'Servidor_proyecto'
> USERNAME = 'admin'
> PASSWORD = 'admin'
> ```

### 4.2 Instalar el módulo `acceso_ies` en Odoo

1. Accede a `http://localhost:8072` e inicia sesión.
2. Ve a **Ajustes → Activar modo desarrollador**.
3. Ve a **Aplicaciones → Actualizar lista de aplicaciones**.
4. Busca **Acceso IES** e instálalo.

### 4.3 Arrancar el backend Flask

```bash
cd backend/
pip install flask flask-cors
python app.py
```

El API quedará escuchando en `http://localhost:5000`.

### 4.4 Abrir las interfaces web

Abre directamente los ficheros HTML en el navegador o sírvelos con cualquier servidor HTTP estático:

```bash
# Ejemplo rápido con Python
python -m http.server 8080
```

| Interfaz | Ruta |
|---|---|
| Panel Jefatura | `pagina web/Jefatura de estudios/pagina_web.html` |
| Terminal alumnos | `scaners/Estudiantes/Estudiantes.html` |
| Terminal profesores | `scaners/Profesores/Profesores.html` |

---

## 5. Panel de Jefatura de Estudios (Web)

### Acceso
Abre `pagina_web.html` en el navegador. Si el backend está activo verás el indicador **"Conectado a Odoo"** en verde en la barra superior.

### Secciones del menú lateral

#### 📊 Estadísticas (Dashboard)
Vista general del día:
- Total de salidas del día.
- Número de incidencias (personas sin tarjeta NFC asignada).
- Gráfico de barras de asistencia de la semana actual (L–V).
- Tabla con el listado completo de alumnos o profesores, su estado de recreo y salida anticipada.

Usa el selector **Alumnos / Profesores** para cambiar entre colectivos.

#### 👩‍🎓 Alumnado
Tabla con todos los alumnos registrados:
- Nombre, apellidos, curso, DNI, fecha de nacimiento, NFC vinculado.
- Columnas **Recreo** y **Salida anticipada** con toggle interactivo (clic para cambiar).
- Barra de búsqueda y filtros por curso.
- Botón **+ Nuevo alumno** para registrar un alumno manualmente.

#### 👨‍🏫 Profesorado
Igual que Alumnado pero para el colectivo de profesores, con filtro por departamento.

#### 🏷️ Vincular NFC
Permite asociar una tarjeta NFC a un alumno o profesor existente sin necesidad de acceder a Odoo directamente:
1. Selecciona el tipo (Alumno / Profesor).
2. Elige la persona en el desplegable.
3. Acerca la tarjeta al lector NFC (el campo se rellena automáticamente) o escribe el ID manualmente.
4. Pulsa **Vincular**.

#### 📋 Asistencia
Registro histórico de todos los fichajes:
- Filtro por colectivo (todos / alumnos / profesores).
- Filtro por fecha.
- Botón **Importar CSV** para cargar registros desde un fichero exportado (formato compatible con el módulo de exportación de la misma página).
- Botón **Exportar CSV** para descargar el listado actual.

##### Formato del CSV de importación
```
nombre,colectivo,tipo,hora
Juan García López,alumno,llegada tarde,15/05/2026 08:35
Ana Martínez,profesor,salida,15/05/2026 14:00
```

---

## 6. Terminales de fichaje NFC (Escáneres web)

### Terminal de Alumnos (`Estudiantes.html`)

Para usar como punto de control de entrada/salida de alumnos:

1. Abre la página en pantalla completa en un ordenador con lector NFC USB.
2. Pulsa **ENTRADA** (llegada tarde) o **SALIDA** (salida anticipada).
3. El sistema espera 15 segundos para que el alumno acerque su tarjeta.
4. La pantalla muestra **¡ACCESO CORRECTO!** en verde o **ACCESO DENEGADO** en rojo.
   - La salida anticipada solo se permite si el alumno tiene el permiso activado en Jefatura.

> El lector NFC debe funcionar en modo **HID/teclado** para que el navegador reciba el ID como si se tecleara.

### Terminal de Profesores (`Profesores.html`)

Funciona igual que el de alumnos pero registra la asistencia en el modelo `acceso_ies.asistencia_profesor`.

- **ENTRADA** → estado `llego al centro`.
- **SALIDA** → estado `salio del centro`.

---

## 7. Aplicación móvil Android

La app está pensada para que un **profesor** inicie sesión con su tarjeta NFC y luego registre la asistencia de sus alumnos.

### Flujo de uso

1. **Inicio de sesión del profesor**  
   Pulsa el icono de perfil (👤). La pantalla pedirá que acerques tu tarjeta NFC.  
   Si la tarjeta está registrada, aparecerá el nombre del profesor en pantalla.

2. **Registrar asistencia de un alumno**  
   Pulsa el botón **Scan** (icono escáner). La pantalla mostrará "Escaneando alumno...".  
   Acerca la tarjeta NFC del alumno; se mostrará su nombre y curso.  
   Pulsa **Siguiente** para registrar al siguiente alumno.

3. **Cerrar sesión**  
   Pulsa **Salir** para cerrar la aplicación.

### Configuración de la URL del servidor

La URL del backend está definida en el código fuente de la app. Si el servidor no está en `localhost`, debes cambiarla antes de compilar en `MainActivity.kt` buscando la constante de la URL de la API.

### Permisos necesarios en el dispositivo
- NFC (obligatorio).
- Acceso a red (para comunicarse con el backend).

---

## 8. API Backend — referencia rápida

El backend corre en `http://localhost:5000`. Todos los endpoints aceptan y devuelven **JSON**.

### Autenticación — API Key

Todas las peticiones deben incluir la cabecera `x-api-key` con la clave secreta configurada en `app.py`. Sin ella el servidor devuelve `401 Unauthorized`.

```
x-api-key: kartu_prosim
```

Ejemplo con `curl`:
```bash
curl -X GET http://localhost:5000/api/alumnado \
     -H "x-api-key: kartu_prosim"
```

Ejemplo con `fetch` (JavaScript):
```javascript
fetch('http://localhost:5000/api/alumnado', {
  headers: { 'x-api-key': 'kartu_prosim' }
});
```

> Para cambiar la clave edita la variable `SECRET_KEY` al inicio de `backend/app.py`.

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/procesar-datos` | Busca un alumno por `{ "nfc": "ID" }` |
| `POST` | `/GetProfesor` | Busca un profesor por `{ "nfc": "ID" }` |
| `POST` | `/create` | Crea alumno o profesor. Incluir campo `"tipo": "alumno"/"profesor"` |
| `POST` | `/AsistenciaEstudiante` | Ficha un alumno: `{ "id_NFC": "...", "estado_asistencia": "llegada_tarde"/"salida" }` |
| `POST` | `/AsistenciaProfesor` | Ficha un profesor: `{ "id_NFC": "...", "estado_asistencia": "entrada"/"salida" }` |
| `POST` | `/Salida_Recreo` | Gestiona permiso de recreo para un alumno por NFC |
| `POST` | `/api/actualizar_estado` | Actualiza un campo booleano de un alumno/profesor |
| `POST` | `/api/vincular_nfc` | Vincula una tarjeta NFC a una persona |
| `GET` | `/api/dashboard?tipo=alumnos` | Datos del dashboard (alumnos o profesores) |
| `GET` | `/api/alumnado` | Lista completa de alumnos |
| `GET` | `/api/profesorado` | Lista completa de profesores |
| `GET` | `/api/asistencia?filtro=todos&fecha=YYYY-MM-DD` | Historial de asistencia |
| `POST` | `/api/importar_asistencia` | Importa registros desde JSON (usado por el CSV) |

---

## 9. Gestión de errores frecuentes

### "Sin conexión Odoo" en el panel web
- Verifica que el contenedor Docker de Odoo está activo: `docker ps`.
- Verifica que el backend Flask está en ejecución: `python backend/app.py`.
- Comprueba que las credenciales en `app.py` son correctas.

### "ERROR DE RED" en el terminal de fichaje
- El backend no está accesible desde el navegador.
- Comprueba que `http://localhost:5000` responde (si el navegador y el backend están en la misma máquina).
- Si el terminal está en otro equipo, cambia `localhost` por la IP del servidor en los ficheros JS de los escáneres.

### La tarjeta NFC no se detecta en el terminal web
- Comprueba que el lector NFC está configurado en modo HID/teclado.
- Prueba haciendo clic en la pantalla del terminal para que tenga el foco del teclado antes de acercar la tarjeta.
- Verifica que el sistema operativo reconoce el lector (aparece como dispositivo de entrada).

### La app móvil no conecta con el servidor
- Asegúrate de que el móvil y el servidor están en la **misma red WiFi**.
- Cambia la URL en la app por la IP local del servidor (p. ej. `http://192.168.1.100:5000`).
- Comprueba que el firewall del servidor permite conexiones al puerto 5000.

### "El ID NFC ya existe" al vincular una tarjeta
- Cada tarjeta NFC solo puede estar asignada a **una persona**.
- Busca quién tiene esa tarjeta asignada desde la sección **Alumnado** o **Profesorado** del panel y desvincula antes de reasignar.

### Odoo no aparece el módulo `acceso_ies`
- Verifica que la carpeta `odoo/addons/acceso_ies/` está montada en el volumen del contenedor (revisa `docker-compose.yaml`).
- Entra en Odoo en modo desarrollador y actualiza la lista de aplicaciones.
