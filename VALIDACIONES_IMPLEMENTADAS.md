# Validaciones Implementadas en el Sistema

## 📋 Resumen de Validaciones

Se han implementado validaciones tanto en el **backend (Flask/Python)** como en el **frontend (JavaScript/HTML5)** para garantizar la integridad de los datos.

---

## 🔒 Validaciones del Backend (`app.py`)

### 1. **Validación de Nombre y Apellidos**
- ✅ **No puede estar vacío**
- ✅ **No puede contener números**
- ✅ **Solo permite**: letras, espacios, guiones (-), apóstrofes ('), tildes (áéíóú) y ñ
- ❌ **Rechaza**: números (0-9) y símbolos especiales (@#$%&, etc.)

**Ejemplo válido**: `José María`, `María del Carmen`, `O'Connor`  
**Ejemplo inválido**: `José123`, `María$`, `Juan@`

---

### 2. **Validación de DNI**
- ✅ **Formato**: 8 dígitos seguidos de 1 letra mayúscula
- ✅ **Verifica la letra** según el algoritmo oficial del DNI español
- ✅ **Opcional**: Si no se proporciona, no es obligatorio

**Formato correcto**: `12345678Z`  
**Cálculo de letra**: El sistema valida que la letra corresponda al número

**Letras válidas por posición**:
```
Número % 23 = Posición → Letra
---------------------------------
0 → T    6  → Y    12 → N    18 → V
1 → R    7  → F    13 → J    19 → H
2 → W    8  → P    14 → Z    20 → L
3 → A    9  → D    15 → S    21 → C
4 → G    10 → X    16 → Q    22 → K
5 → M    11 → B    17 → V    23 → E
```

---

### 3. **Validación de Fecha de Nacimiento (Solo Estudiantes)**
- ✅ **Es obligatoria** para estudiantes
- ✅ **No puede ser futura**
- ✅ **Edad mínima**: 10 años
- ✅ **Edad máxima**: 80 años
- ✅ **Formato requerido**: `YYYY-MM-DD` (año-mes-día)

**Ejemplo válido**: `2010-05-15` (persona de ~16 años)  
**Ejemplo inválido**: `2030-01-01` (fecha futura)

---

### 4. **Validaciones por Tipo de Registro**

#### **Para Estudiantes**:
- ✅ Nombre (obligatorio)
- ✅ Apellidos (obligatorio)
- ✅ Fecha de nacimiento (obligatorio)
- ✅ Curso (obligatorio)
- ⚪ DNI (opcional)
- ⚪ Código NFC (opcional)

#### **Para Profesores**:
- ✅ Nombre (obligatorio)
- ✅ Apellidos (obligatorio)
- ✅ Departamento (obligatorio)
- ⚪ DNI (opcional)
- ⚪ Código NFC (opcional)

---

## 🌐 Validaciones del Frontend (JavaScript + HTML5)

### **Validaciones en Tiempo Real** (`script.js`)

Al intentar crear un registro, el sistema verifica:

1. **Nombre y Apellidos**:
   - Detecta si contienen números con expresión regular: `/\d/`
   - Muestra mensaje específico: "El nombre/apellidos no pueden contener números"

2. **DNI**:
   - Patrón: `/^\d{8}[A-Z]$/i`
   - Mensaje: "El DNI debe tener 8 dígitos y 1 letra (ej: 12345678A)"

3. **Fecha de Nacimiento**:
   - Verifica que no sea futura
   - Calcula edad y verifica rango 10-80 años
   - Mensaje: "La edad debe estar entre 10 y 80 años"

### **Validaciones HTML5 Nativas** (`pagina_web.html`)

Los campos de entrada incluyen atributos HTML5 para validación del navegador:

```html
<!-- Nombre/Apellidos -->
<input type="text" 
       pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+" 
       title="Solo letras, espacios, guiones y apóstrofes"
       required>

<!-- DNI -->
<input type="text" 
       pattern="\d{8}[A-Za-z]" 
       title="8 dígitos seguidos de una letra"
       maxlength="9"
       placeholder="12345678A">

<!-- Fecha de Nacimiento -->
<input type="date" required>
```

---

## ⚠️ Mensajes de Error Mejorados

### **En el Backend**:

El servidor ahora devuelve mensajes específicos y códigos HTTP apropiados:

- `400 Bad Request`: Datos inválidos (nombre con números, DNI mal formato, etc.)
- `409 Conflict`: NFC duplicado
- `500 Internal Server Error`: Error de base de datos

**Ejemplos de mensajes**:
```json
{"status": "error", "mensaje": "Nombre inválido: El nombre no puede contener números"}
{"status": "error", "mensaje": "DNI inválido: El DNI debe tener 8 dígitos seguidos de una letra"}
{"status": "error", "mensaje": "Fecha de nacimiento inválida: La edad calculada (5 años) es demasiado baja"}
{"status": "error", "mensaje": "El código NFC ya está asignado a otra persona"}
```

### **En el Frontend**:

Los mensajes aparecen inmediatamente debajo del formulario con código de colores:

- 🔴 **Rojo**: Errores críticos
- 🔵 **Azul**: Procesando...
- 🟢 **Verde**: Éxito

---

## 🧪 Casos de Prueba

### ✅ **Casos Válidos**:

**Estudiante**:
```json
{
  "tipo": "alumno",
  "nombre": "María José",
  "apellidos": "García López",
  "curso": "1dam",
  "fecha_nacimiento": "2008-03-15",
  "dni": "12345678Z"
}
```

**Profesor**:
```json
{
  "tipo": "profesor",
  "nombre": "Juan Carlos",
  "apellidos": "Pérez Sánchez",
  "departamento": "informatica",
  "dni": "87654321X"
}
```

### ❌ **Casos Inválidos** (con mensaje de error):

```json
// Nombre con números
{"nombre": "Juan123"}
→ "Nombre inválido: El nombre no puede contener números"

// DNI con formato incorrecto
{"dni": "1234567"}
→ "DNI inválido: El DNI debe tener 8 dígitos seguidos de una letra"

// DNI con letra incorrecta
{"dni": "12345678A"}
→ "DNI inválido: La letra del DNI no es correcta. Debería ser Z"

// Fecha futura
{"fecha_nacimiento": "2030-01-01"}
→ "Fecha de nacimiento inválida: La fecha de nacimiento no puede ser futura"

// Edad muy baja
{"fecha_nacimiento": "2020-01-01"}
→ "Fecha de nacimiento inválida: La edad calculada (6 años) es demasiado baja"
```

---

## 🔄 Flujo de Validación

```
Usuario rellena formulario
       ↓
Validación HTML5 (navegador)
       ↓
Clic en "Registrar"
       ↓
Validación JavaScript (cliente)
       ↓
Envío al servidor (POST /create)
       ↓
Validación Python (servidor)
       ↓
Guardado en Odoo
       ↓
Respuesta al usuario
```

---

## 📌 Notas Importantes

1. **Doble validación**: Cliente y servidor para mayor seguridad
2. **DNI no obligatorio**: Útil para estudiantes extranjeros o en proceso de tramitación
3. **NFC opcional al crear**: Se puede vincular posteriormente desde la sección NFC
4. **Mensajes en español**: Todos los errores están en español para facilitar comprensión
5. **Compatibilidad**: Las validaciones funcionan en navegadores modernos (Chrome, Firefox, Edge, Safari)

---

## 🛠️ Archivos Modificados

- ✅ `backend/app.py` - Funciones de validación y endpoint `/create`
- ✅ `pagina web/Jefatura de estudios/script.js` - Validaciones JavaScript
- ✅ `pagina web/Jefatura de estudios/pagina_web.html` - Atributos HTML5

---

**Última actualización**: 12 Mayo 2026  
**Versión del sistema**: 1.0.3
