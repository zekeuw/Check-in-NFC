# 📋 Resumen de Cambios - Sistema de Recreo Mejorado

## ✅ Cambios Implementados

### 1. **Modelo de Odoo** (`odoo/addons/acceso_ies/models/models.py`)

#### Modelo Estudiante:
- ✅ **Nuevo campo**: `en_recreo` (Boolean) - Indica si el estudiante está actualmente en el recreo
- El campo `recreo` existente sigue indicando si tiene **permiso** para salir al recreo

#### Modelo AsistenciaEstudiante:
- ✅ **Nuevos estados añadidos**:
  - `'sale recreo'` - Sale al Recreo
  - `'vuelve recreo'` - Vuelve del Recreo

### 2. **Backend Flask** (`backend/app.py`)

#### Endpoint `/Salida_Recreo` (POST):
**Lógica automática implementada:**
```javascript
// Determina automáticamente si el estudiante está saliendo o volviendo
- Primera vez del día → "sale recreo" + en_recreo=True
- Si último registro es "sale recreo" → "vuelve recreo" + en_recreo=False
- Si último registro es "vuelve recreo" → "sale recreo" + en_recreo=True
```

**Mejoras:**
- ✅ No requiere parámetros adicionales de la app móvil
- ✅ Calcula automáticamente la acción basándose en el historial del día
- ✅ Actualiza el campo `en_recreo` del estudiante
- ✅ Crea registro de asistencia con el estado correspondiente
- ✅ Valida que el estudiante tenga permiso de recreo

#### Otros endpoints modificados:
- `/api/alumnado` - Incluye campo `en_recreo`
- `/api/dashboard` - Incluye campo `en_recreo` en los datos

### 3. **Frontend - Panel de Jefatura** (`pagina web/Jefatura de estudios/script.js`)

**Cambios en la visualización:**
- ❌ **Eliminado**: Cálculo basado en horario fijo (11:00-11:30)
- ✅ **Nuevo**: Estado de recreo basado en el campo `en_recreo`

**Ahora muestra:**
- 🟢 **EN CENTRO** - Si `en_recreo = false` y no ha salido anticipadamente
- 🟡 **EN RECREO** - Si `en_recreo = true` (basado en registros reales)
- 🔴 **HA SALIDO** - Si `salida_anticipada = true`

---

## 🚀 Cómo Aplicar los Cambios

### Paso 1: Actualizar Odoo
```bash
cd /home/admin-server/Desktop/Check-in-NFC-Version-Previa-a-Final
./actualizar_modulo_odoo.sh
```

O manualmente:
```bash
cd odoo
docker exec odoo-server-ies odoo -u acceso_ies -d Servidor_proyecto --stop-after-init
docker compose restart
```

### Paso 2: Reiniciar el Backend Flask
```bash
# Si está corriendo, detenerlo (Ctrl+C) y reiniciar:
cd backend
python3 app.py
```

### Paso 3: Refrescar el Panel de Jefatura
Simplemente refrescar la página web (F5) para cargar el nuevo JavaScript.

---

## 🔄 Flujo de Funcionamiento

### Ejemplo de uso del día:

**08:00** - Alumno llega al centro (entrada normal)

**11:00** - Alumno escanea tarjeta en terminal de recreo
- Sistema detecta: No hay registros de recreo hoy
- Acción: Crea "sale recreo" + `en_recreo = True`
- Panel muestra: 🟡 **EN RECREO**

**11:25** - Alumno vuelve y escanea tarjeta
- Sistema detecta: Último registro es "sale recreo"
- Acción: Crea "vuelve recreo" + `en_recreo = False`
- Panel muestra: 🟢 **EN CENTRO**

**12:30** - Alumno sale al recreo de nuevo
- Sistema detecta: Último registro es "vuelve recreo"
- Acción: Crea "sale recreo" + `en_recreo = True`
- Panel muestra: 🟡 **EN RECREO**

---

## 📊 Campos de Base de Datos

### Tabla `acceso_ies.estudiante`:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `recreo` | Boolean | **Permiso** de salir al recreo (por edad) |
| `en_recreo` | Boolean | **Estado actual** - ¿Está en el recreo ahora? |

### Tabla `acceso_ies.asistencia_estudiante`:
| Estado | Descripción |
|--------|-------------|
| `'llego tarde'` | Llegó tarde al centro |
| `'salida anticipada'` | Salió anticipadamente del centro |
| `'sale recreo'` | 🆕 Sale al recreo |
| `'vuelve recreo'` | 🆕 Vuelve del recreo |

---

## ⚠️ Importante

1. **No afecta a la app móvil**: El endpoint sigue recibiendo solo el `nfc_id`, no requiere cambios en la app
2. **Retrocompatible**: Los registros antiguos no se ven afectados
3. **Histórico completo**: Todos los movimientos de recreo quedan registrados en la base de datos

---

## ✅ Pruebas Sugeridas

1. Verificar que el módulo se actualizó correctamente en Odoo
2. Probar el endpoint `/Salida_Recreo` con Postman:
   ```json
   POST http://localhost:5000/Salida_Recreo
   {
     "nfc": "ID_DE_TARJETA_NFC"
   }
   ```
3. Verificar en el panel de Jefatura que el estado cambia correctamente
4. Probar múltiples salidas/vueltas del recreo en el mismo día

---

## 🐛 Posibles Problemas

### "Campo en_recreo no existe"
- **Solución**: Ejecutar `./actualizar_modulo_odoo.sh`

### "Estado de recreo no se actualiza en el panel"
- **Solución**: Refrescar la página (F5) o limpiar caché del navegador

### "Error al crear registro de asistencia"
- **Verificar**: Que los nuevos estados estén en el modelo de Odoo
- **Solución**: Reiniciar los contenedores de Docker
