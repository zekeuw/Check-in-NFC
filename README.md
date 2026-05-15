# Sistema de Control de Acceso NFC - IES San Juan de la Rambla

Sistema integral de gestión y control de asistencia mediante tecnología NFC para centros educativos. Desarrollado para el IES San Juan de la Rambla.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)
![Odoo](https://img.shields.io/badge/Odoo-18.0-purple.svg)

## Descripción

Sistema completo de control de acceso y gestión de asistencia que permite:
- **Control de entrada/salida** de estudiantes y profesores mediante tarjetas NFC
- **Gestión centralizada** desde panel web de jefatura de estudios
- **Registro automático** de llegadas tarde y salidas anticipadas
- **Estadísticas en tiempo real** con gráficos interactivos
- **Gestión de permisos** de recreo y salidas según edad
- **Exportación de datos** a CSV para informes
- **Integración con Odoo** para almacenamiento persistente

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND WEB                         │
│  Panel de Jefatura + Escáneres NFC (Estudiantes/Profes) │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────▼────────────────────────────────────┐
│                  BACKEND FLASK                          │
│  • API REST (Python 3.8+)                               │
│  • Validaciones de datos                                │
│  • Autenticación con API Key                            │
│  • Gestión de asistencias                               │
└────────────────────┬────────────────────────────────────┘
                     │ XML-RPC
┌────────────────────▼────────────────────────────────────┐
│                  ODOO 18.0                              │
│  • Base de datos PostgreSQL                             │
│  • Módulo personalizado: acceso_ies                     │
│  • Modelos: Estudiantes, Profesores, Asistencias        │
└─────────────────────────────────────────────────────────┘
```

## Características Principales

### Panel de Jefatura de Estudios
- **Dashboard interactivo** con estadísticas en tiempo real
- **Gestión de alumnado y profesorado** (CRUD completo)
- **Vinculación/desvinculación de tarjetas NFC**
- **Registro de asistencias** con filtros por fecha y tipo
- **Importación masiva** de datos desde CSV
- **Exportación de reportes** en formato CSV
- **Gráficos dinámicos** (Chart.js) de asistencia semanal

### Terminales NFC
- **Escáner de estudiantes**: Control de llegadas tarde y salidas anticipadas
- **Escáner de profesores**: Registro de entrada/salida del centro
- **Interfaz responsive** adaptada a tablets
- **Diseño intuitivo** con feedback visual inmediato

### Backend API
- **Autenticación segura** mediante API Key
- **Validaciones robustas** (DNI español, fechas, nombres, etc.)
- **Reconexión automática** a Odoo en caso de pérdida de conexión
- **Logging completo** de operaciones
- **Suite de 44 tests** automatizados con pytest

## Estructura del Proyecto

```
Check-in-NFC-Version-Previa-a-Final/
├── backend/                          # API Flask
│   ├── app.py                       # Aplicación principal
│   ├── test_app.py                  # Tests unitarios (44 tests)
│   └── requirements.txt             # Dependencias Python
│
├── odoo/                            # Servidor Odoo
│   ├── addons/
│   │   └── acceso_ies/             # Módulo personalizado
│   │       ├── models/             # Modelos de datos
│   │       ├── views/              # Vistas XML
│   │       ├── security/           # Permisos y accesos
│   │       └── controllers/        # Controladores web
│   ├── config/
│   │   └── odoo.conf              # Configuración Odoo
│   └── docker-compose.yaml         # Despliegue Docker
│
├── pagina web/
│   └── Jefatura de estudios/       # Panel web principal
│       ├── pagina_web.html         # Interfaz principal
│       ├── script.js               # Lógica JavaScript
│       └── style.css               # Estilos CSS
│
├── scaners/
│   ├── Estudiantes/                # Terminal para alumnos
│   │   ├── Estudiantes.html
│   │   ├── estudiantes.js
│   │   └── style_estudiantes.css
│   └── Profesores/                 # Terminal para profesores
│       ├── Profesores.html
│       ├── profesores.js
│       └── style_profesores.css
│
└── GUIA_DESPLIEGUE.md              # Guía de instalación
```

## Tecnologías Utilizadas

### Backend
- **Python 3.8+**
- **Flask 3.0+** - Framework web
- **Flask-CORS** - Gestión de CORS
- **pytest** - Testing framework

### Base de Datos
- **Odoo 18.0** - ERP/Framework
- **PostgreSQL 15** - Base de datos

### Frontend
- **HTML5 / CSS3 / JavaScript** - Tecnologías base
- **Chart.js** - Gráficos interactivos
- **UI Avatars API** - Avatares generados

### DevOps
- **Docker & Docker Compose** - Contenedorización de Odoo
- **Git** - Control de versiones

## Instalación

### Prerrequisitos

```bash
# Sistema operativo
- Linux (Debian/Ubuntu recomendado)
- Python 3.8 o superior
- Docker y Docker Compose
- Git
```

### 1. Clonar el Repositorio

```bash
git clone https://github.com/zekeuw/Check-in-NFC.git
cd Check-in-NFC-IES
```

### 2. Configurar Backend Flask

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables (app.py)
URL = 'http://localhost:8072'
DB = 'Servidor_proyecto'
USERNAME = 'admin'
PASSWORD = 'admin'
SECRET_KEY = "kartu_prosim"
```

### 3. Desplegar Odoo con Docker

```bash
cd ../odoo

# Iniciar contenedores
docker compose up -d

# Verificar estado
docker compose ps
```

Acceder a Odoo en `http://localhost:8072` y crear la base de datos `Servidor_proyecto`.

### 4. Instalar Módulo Personalizado

1. Acceder a Odoo → Apps → Update Apps List
2. Buscar "acceso_ies"
3. Instalar el módulo
4. Verificar que los modelos están creados

### 5. Iniciar Backend

```bash
cd ../backend
python3 app.py
```

El servidor estará disponible en `http://localhost:5000`

### 6. Abrir Interfaces Web

- **Panel de Jefatura**: `http://localhost:5000/`
  - Usuario: `admin`
  - Contraseña: `admin`

- **Escáner Estudiantes**: `http://localhost:5000/Estudiantes`
- **Escáner Profesores**: `http://localhost:5000/Profesores`

## Testing

El proyecto incluye una suite completa de 44 tests automatizados:

```bash
cd backend

# Ejecutar todos los tests
python3 -m pytest test_app.py -v

# Ejecutar con resumen
python3 -m pytest test_app.py --quiet
```

### Cobertura de Tests
- Validaciones (nombres, DNI, fechas)
- Seguridad (API Key)
- CRUD de estudiantes y profesores
- Vinculación/desvinculación NFC
- Registro de asistencias
- Gestión de permisos de recreo
- Consultas y filtros

## Uso del Sistema

### Gestión de Alumnado

1. Acceder al panel de Jefatura
2. Ir a la sección **Alumnado**
3. Click en **Añadir Alumno**
4. Rellenar datos obligatorios:
   - Nombre y apellidos
   - DNI (validación formato español)
   - Curso
   - Fecha de nacimiento
5. Guardar y vincular tarjeta NFC

### Vinculación de Tarjetas NFC

1. Crear un Alumno/Profesor
2. Ir a **Vinculación NFC**
3. Seleccionar tipo (Alumno/Profesor)
4. Seleccionar persona de la lista
5. Escanear tarjeta NFC o introducir código
6. Confirmar vinculación

### Registro de Asistencia

**Estudiantes:**
- Seleccionar la acción deseada
- Acercar tarjeta al lector en terminal de estudiantes

**Profesores:**
- Seleccionar la acción deseada
- Acercar tarjeta al lector en terminal de profesores
- Sistema registra:
  - Llegada al centro
  - Salida del centro

### Exportación de Datos

1. Ir a **Asistencia**
2. Aplicar filtros deseados (fecha, tipo, etc.)
3. Click en **Exportar CSV**
4. Descargar archivo generado

### Importación Masiva

1. Preparar CSV con formato:
   ```
   nombre,colectivo,tipo,hora,notas
   Juan Pérez,Alumno,llegada tarde,2023-05-14 08:30,Registrado por NFC
   ```
2. Ir a **Asistencia**
3. Click en **Importar CSV**
4. Seleccionar archivo
5. Revisar resultados de importación

## Seguridad

### API Key
Todas las peticiones protegidas requieren header:
```
x-api-key: kartu_prosim
```

### Validaciones Implementadas

- **DNI**: Validación de formato y letra correcta (algoritmo oficial)
- **Nombres**: Solo caracteres alfabéticos, tildes y ñ
- **Fechas**: Rango razonable de edad (10-80 años)
- **NFC único**: No se pueden duplicar tarjetas
- **Permisos**: Control de salidas según edad y configuración

### Rutas Públicas (sin API Key)
- `/` - Página principal
- `/Estudiantes` - Terminal estudiantes
- `/Profesores` - Terminal profesores
- `/GetProfesor` - Consulta profesor
- `/AsistenciaEstudiante` - Registro estudiante
- `/AsistenciaProfesor` - Registro profesor

## Configuración

### Backend (app.py)
```python
URL = 'http://localhost:8072'  # URL de Odoo
DB = 'Servidor_proyecto'        # Nombre BD
USERNAME = 'admin'              # Usuario Odoo
PASSWORD = 'admin'              # Contraseña Odoo
SECRET_KEY = "kartu_prosim"     # API Key
```

### Frontend (desde Panel Web)
- Ir a **Configuración**
- Modificar URL del servidor
- Modificar API Key
- Guardar cambios

### Odoo (docker-compose.yaml)
```yaml
environment:
  - HOST=db-dev
  - USER=odoo
  - PASSWORD=odoo
ports:
  - "8072:8069"
```

## Modelos de Datos

### Estudiante
- `nombre` (String, requerido)
- `apellidos` (String, requerido)
- `curso` (Selection, requerido)
- `fecha_nacimiento` (Date, requerido)
- `dni` (String, 9 caracteres)
- `id_NFC` (String, único)
- `recreo` (Boolean)
- `salida_anticipada` (Boolean)

### Profesor
- `nombre` (String, requerido)
- `apellidos` (String, requerido)
- `dni` (String, 9 caracteres)
- `id_NFC` (String, único)
- `departamento` (Selection)

### Asistencia Estudiante
- `fecha` (Datetime, auto)
- `estudiante_id` (Many2one)
- `id_NFC` (String, relacionado)
- `estado_asistencia` (Selection: 'llego tarde', 'salida anticipada')

### Asistencia Profesor
- `fecha` (Datetime, auto)
- `profesor_id` (Many2one)
- `id_NFC` (String, relacionado)
- `estado_asistencia` (Selection: 'llego al centro', 'sale del centro')

## Solución de Problemas

### Error: Puerto 5000 en uso
```bash
# Liberar puerto
lsof -ti:5000 | xargs kill -9
```

### Error: No conecta con Odoo
```bash
# Verificar contenedores
docker compose ps

# Reiniciar Odoo
cd odoo
docker compose restart
```

### Error: Módulo no aparece en Odoo
```bash
# Actualizar lista de apps
docker exec odoo-server-ies odoo -u acceso_ies -d Servidor_proyecto --stop-after-init
docker compose restart
```

### Tests fallan
```bash
# Instalar pytest
pip install pytest

# Verificar instalación
python3 -m pytest --version
```

## Documentación Adicional

- [GUIA_DESPLIEGUE.md](GUIA_DESPLIEGUE.md) - Guía completa de despliegue
- [GUIA_USUARIO.md](GUIA_USUARIO.md) - Manual de usuario
- [VALIDACIONES_IMPLEMENTADAS.md](VALIDACIONES_IMPLEMENTADAS.md) - Detalle de validaciones

## Autores

- **Equipo de Desarrollo** - NFCitos
- **Proyecto Final de Ciclo** - 2026

## Agradecimientos

- IES San Juan de la Rambla por el "apoyo" al proyecto
- Comunidad de Odoo por la documentación
- Chart.js por la librería de gráficos
- UI Avatars por la API de avatares
- A la máquina de café de la entrada
- A las metricas de la memoria a 3 horas de entregar el proyecto :)

 y por ultimo y no menos importante

- A la cafetería del instituto

**Nota**: Este proyecto está diseñado específicamente para entornos educativos y puede requerir adaptaciones para otros contextos.

Desarrollado con ❤️ por el maravilloso y muy guay equipo de los NFCitos
