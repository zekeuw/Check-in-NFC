# Guía de Despliegue — Sistema de Control de Acceso NFC (IES)

## Índice
1. [Requisitos del servidor](#1-requisitos-del-servidor)
2. [Estructura de puertos](#2-estructura-de-puertos)
3. [Clonar el repositorio](#3-clonar-el-repositorio)
4. [Despliegue de Odoo con Docker](#4-despliegue-de-odoo-con-docker)
5. [Despliegue del backend Flask](#5-despliegue-del-backend-flask)  
   5a. [Ejecución directa (desarrollo)](#5a-ejecución-directa-desarrollo)  
   5b. [Ejecución con Docker (producción)](#5b-ejecución-con-docker-producción)  
   5c. [Ejecución como servicio systemd (producción)](#5c-ejecución-como-servicio-systemd-producción)
6. [Despliegue de las interfaces web](#6-despliegue-de-las-interfaces-web)
7. [Configuración de variables clave](#7-configuración-de-variables-clave)
8. [Verificación del despliegue](#8-verificación-del-despliegue)
9. [Actualización del sistema](#9-actualización-del-sistema)

---

## 1. Requisitos del servidor

| Requisito | Versión mínima |
|---|---|
| Sistema operativo | Ubuntu 22.04 LTS / Debian 12 |
| Docker Engine | 24.x |
| Docker Compose | v2.x (plugin integrado) |
| Python | 3.10+ |
| RAM | 4 GB (8 GB recomendado) |
| Disco | 20 GB libres |

Instalación rápida de Docker en Ubuntu/Debian:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # permite usar docker sin sudo
newgrp docker
```

---

## 2. Estructura de puertos

| Servicio | Puerto externo | Puerto interno |
|---|---|---|
| Odoo | **8072** | 8069 |
| PostgreSQL (Odoo) | **5432** | 5432 |
| Backend Flask | **5000** | 5000 |
| Servidor web estático (opcional) | **8080** | 8080 |

Asegúrate de que el firewall permite el tráfico en estos puertos desde las máquinas cliente:
```bash
sudo ufw allow 8072/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 8080/tcp
```

---

## 3. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO> /opt/nfc-ies
cd /opt/nfc-ies
```

> Si no usas Git, copia la carpeta del proyecto al servidor manualmente y sitúate en su raíz.

---

## 4. Despliegue de Odoo con Docker

### 4.1 Levantar los contenedores

```bash
cd odoo/
docker compose up -d
```

Esto arranca dos contenedores:

| Contenedor | Imagen | Función |
|---|---|---|
| `odoo-server-ies` | `odoo:18.0` | ERP / base de datos de negocio |
| `odoo-db-ies` | `postgres:15` | Base de datos relacional |

Los datos persisten en volúmenes Docker nombrados (`odoo_dev_db_data`, `odoo_dev_data`), por lo que se conservan al reiniciar.

### 4.2 Comprobar que los contenedores están activos

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Deberías ver ambos contenedores en estado `Up`.

### 4.3 Crear la base de datos e instalar el módulo `acceso_ies`

1. Abre `http://<IP_SERVIDOR>:8072` en el navegador.
2. Crea una nueva base de datos con el nombre exacto: **`Servidor_proyecto`**  
   - Idioma: Español  
   - País: España  
   - Contraseña maestra (admin password): `admin`
3. Una vez dentro, ve a **Ajustes → Activar modo desarrollador**.
4. Ve a **Aplicaciones → Actualizar lista de aplicaciones**.
5. Busca **Acceso IES** e instálalo.

> El módulo `acceso_ies` está en `odoo/addons/acceso_ies/` y ya está montado en el contenedor como volumen (`./addons:/mnt/extra-addons`). Si no aparece, verifica que `odoo.conf` contiene `addons_path = /mnt/extra-addons,...`.

### 4.4 Detener / reiniciar Odoo

```bash
# Detener
docker compose down

# Reiniciar y aplicar cambios en el módulo
docker compose down && docker compose up -d
```

---

## 5. Despliegue del backend Flask

### 5a. Ejecución directa (desarrollo)

```bash
cd backend/
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

El servidor queda escuchando en `http://0.0.0.0:5000`.

---

### 5b. Ejecución con Docker (producción)

El `dockerfile` en `backend/` ya está listo para construir la imagen:

```bash
cd backend/
docker build -t nfc-backend-ies .
docker run -d \
  --name nfc-backend \
  --restart unless-stopped \
  --network host \
  nfc-backend-ies
```

> Se usa `--network host` para que el backend pueda alcanzar Odoo en `localhost:8072` sin configuración de red adicional.

Verificar que está activo:
```bash
docker logs nfc-backend
```

---

### 5c. Ejecución como servicio systemd (producción)

Esta opción permite que el backend arranque automáticamente con el servidor.

1. Crea el entorno virtual e instala dependencias:
```bash
cd /opt/nfc-ies/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Crea el fichero de servicio:
```bash
sudo nano /etc/systemd/system/nfc-backend.service
```

Contenido:
```ini
[Unit]
Description=NFC IES Backend Flask
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/nfc-ies/backend
ExecStart=/opt/nfc-ies/backend/.venv/bin/python app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

3. Activa e inicia el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nfc-backend
sudo systemctl start nfc-backend
sudo systemctl status nfc-backend
```

---

## 6. Despliegue de las interfaces web

Las interfaces son páginas HTML+JS estáticas. Se pueden servir con cualquier servidor HTTP.

### Opción A — Python (sencilla, para pruebas)

```bash
cd /opt/nfc-ies
python3 -m http.server 8080
```

### Opción B — Nginx (recomendada para producción)

```bash
sudo apt install nginx -y
sudo cp -r "/opt/nfc-ies/pagina web" /var/www/html/jefatura
sudo cp -r /opt/nfc-ies/scaners /var/www/html/scaners
```

Crea un virtual host:
```bash
sudo nano /etc/nginx/sites-available/nfc-ies
```

```nginx
server {
    listen 8080;
    server_name _;
    root /var/www/html;
    index pagina_web.html;

    location /jefatura/ {
        alias /var/www/html/jefatura/Jefatura\ de\ estudios/;
    }

    location /scanner-alumnos/ {
        alias /var/www/html/scaners/Estudiantes/;
    }

    location /scanner-profesores/ {
        alias /var/www/html/scaners/Profesores/;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nfc-ies /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Configuración de variables clave

Antes de desplegar en un entorno real, revisa y ajusta estos valores:

### `backend/app.py`

```python
URL        = 'http://localhost:8072'   # Cambiar si Odoo está en otro host
DB         = 'Servidor_proyecto'       # Nombre exacto de la BD en Odoo
USERNAME   = 'admin'
PASSWORD   = 'admin'
SECRET_KEY = "kartu_prosim"            # ⚠️ Cambiar por una clave segura en producción
```

### `scaners/Estudiantes/estudiantes.js` y `scaners/Profesores/profesores.js`

```javascript
const API_URL = 'http://localhost:5000/AsistenciaEstudiante';
//                ^^^^^^^^^^^^^^^^^ Cambiar por la IP/dominio real del servidor
```

### `pagina web/Jefatura de estudios/script.js`

```javascript
const BASE_URL = 'http://localhost:5000';
//               ^^^^^^^^^^^^^^^^^ Cambiar por la IP/dominio real del servidor
```

> Todos los clientes web deben incluir la cabecera `x-api-key: <SECRET_KEY>` en cada petición al backend. Revisa que la clave sea la misma en `app.py` y en los ficheros JS.

---

## 8. Verificación del despliegue

Ejecuta los siguientes comprobantes en orden después del despliegue:

```bash
# 1. Contenedores Docker activos
docker ps

# 2. Odoo accesible
curl -o /dev/null -s -w "%{http_code}" http://localhost:8072/web/login
# → debe devolver 200

# 3. Backend Flask respondiendo
curl -s -o /dev/null -w "%{http_code}" \
     -H "x-api-key: kartu_prosim" \
     http://localhost:5000/api/alumnado
# → debe devolver 200

# 4. Logs del backend (últimas 20 líneas)
# Si usas systemd:
sudo journalctl -u nfc-backend -n 20
# Si usas Docker:
docker logs nfc-backend --tail 20
```

---

## 9. Actualización del sistema

### Actualizar el módulo Odoo (`acceso_ies`)

```bash
# Copia los nuevos ficheros al servidor y reinicia el contenedor
cd odoo/
docker compose restart odoo-dev
```

Odoo detecta el flag `update = acceso_ies` en `odoo.conf` y aplica las migraciones automáticamente al reiniciar.

Si hay cambios en los modelos (nuevos campos), fuerza la actualización:
```bash
docker exec odoo-server-ies odoo -c /etc/odoo/odoo.conf -u acceso_ies -d Servidor_proyecto --stop-after-init
docker compose restart odoo-dev
```

### Actualizar el backend Flask

```bash
# Con systemd
cd /opt/nfc-ies/backend
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart nfc-backend

# Con Docker
docker build -t nfc-backend-ies . && \
docker rm -f nfc-backend && \
docker run -d --name nfc-backend --restart unless-stopped --network host nfc-backend-ies
```

### Actualizar las interfaces web

Basta con sobreescribir los ficheros HTML/CSS/JS en la ruta servida por Nginx y recargar:
```bash
sudo cp -r "/opt/nfc-ies/pagina web/." /var/www/html/jefatura/
sudo cp -r /opt/nfc-ies/scaners/. /var/www/html/scaners/
```

No es necesario reiniciar Nginx para cambios en ficheros estáticos.
