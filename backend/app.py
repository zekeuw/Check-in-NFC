from flask import Flask, request, jsonify
from flask_cors import CORS
import xmlrpc.client
from datetime import datetime, timedelta
import http.client
import re

URL = 'http://localhost:8072'
DB = 'Servidor_proyecto'
USERNAME = 'admin'
PASSWORD = 'admin'

SECRET_KEY = "kartu_prosim"

app = Flask(__name__)
CORS(app)

uid = None
models = None

def obtener_conexion_odoo():
    """Obtiene o crea una nueva conexión a Odoo"""
    global uid, models
    
    try:
        if not uid:
            common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
            uid = common.authenticate(DB, USERNAME, PASSWORD, {})
            if uid:
                print(f"✓ Conexión exitosa con Odoo! UID: {uid}")
        
        # Crear nueva instancia de models para evitar problemas de conexión reutilizada
        models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)
        return True
    except Exception as e:
        print(f"Error conectando con Odoo: {e}")
        return False

@app.before_request
def asegurar_conexion_odoo():
    if request.method == 'OPTIONS':
        return

    clave_recibida = request.headers.get('x-api-key')
    
    if clave_recibida != SECRET_KEY:
        return jsonify({'status': 'error', 'mensaje': 'Acceso denegado. API Key inválida o faltante.'}), 401
    
    # Asegurar conexión al inicio de cada request
    if not uid:
        obtener_conexion_odoo()

def ejecutar_odoo_kw(*args, **kwargs):
    """Wrapper para ejecutar comandos Odoo con reconexión automática en caso de error"""
    global models
    
    try:
        # Asegurar que tenemos una conexión fresca
        if not models:
            obtener_conexion_odoo()
        return models.execute_kw(*args, **kwargs)
    except (http.client.ResponseNotReady, http.client.CannotSendRequest, ConnectionError, Exception) as e:
        error_str = str(e).lower()
        # Solo reconectar si es un error de conexión
        if 'idle' in error_str or 'request-sent' in error_str or 'cannot send request' in error_str:
            print(f"⚠ Reconectando por error de conexión: {e}")
            # Reconectar y reintentar
            obtener_conexion_odoo()
            return models.execute_kw(*args, **kwargs)
        else:
            # Si no es error de conexión, relanzar
            raise

def limpiar_datos(datos):
    for clave, valor in datos.items():
        if valor == "":
            datos[clave] = None
    return datos

def validar_nombre(nombre):
    """Valida que el nombre solo contenga letras, espacios, tildes y caracteres especiales españoles"""
    if not nombre or nombre.strip() == "":
        return False, "El nombre no puede estar vacío"
    
    # Permitir letras (incluyendo ñ, tildes), espacios, guiones y apóstrofes
    patron = r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$"
    if not re.match(patron, nombre):
        return False, "El nombre no puede contener números ni caracteres especiales"
    
    return True, None

def validar_dni(dni):
    """Valida el formato del DNI español (8 dígitos + 1 letra)"""
    if not dni or dni.strip() == "":
        return True, None  # DNI es opcional
    
    dni = dni.strip().upper()
    
    # Verificar formato: 8 dígitos + 1 letra
    patron = r'^\d{8}[A-Z]$'
    if not re.match(patron, dni):
        return False, "El DNI debe tener 8 dígitos seguidos de una letra (ejemplo: 12345678A)"
    
    # Validar letra correcta del DNI
    letras_dni = 'TRWAGMYFPDXBNJZSQVHLCKE'
    numero = int(dni[:8])
    letra_correcta = letras_dni[numero % 23]
    
    if dni[8] != letra_correcta:
        return False, f"La letra del DNI no es correcta. Debería ser {letra_correcta}"
    
    return True, None

def validar_fecha_nacimiento(fecha_str):
    """Valida que la fecha de nacimiento sea coherente"""
    if not fecha_str or fecha_str.strip() == "":
        return False, "La fecha de nacimiento es obligatoria para estudiantes"
    
    try:
        fecha = datetime.strptime(fecha_str, '%Y-%m-%d')
        hoy = datetime.now()
        
        # Verificar que no sea una fecha futura
        if fecha > hoy:
            return False, "La fecha de nacimiento no puede ser futura"
        
        # Calcular edad
        edad = hoy.year - fecha.year - ((hoy.month, hoy.day) < (fecha.month, fecha.day))
        
        # Validar rango de edad razonable (entre 10 y 80 años)
        if edad < 10:
            return False, f"La edad calculada ({edad} años) es demasiado baja. Verifica la fecha"
        
        if edad > 80:
            return False, f"La edad calculada ({edad} años) es demasiado alta. Verifica la fecha"
        
        return True, None
        
    except ValueError:
        return False, "Formato de fecha inválido. Debe ser YYYY-MM-DD"

@app.route('/procesar-datos', methods=['POST'])
def ejecutar_funcion():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        resultado = ejecutar_odoo_kw(DB, uid, PASSWORD,
                             'acceso_ies.estudiante', 'search_read',
                             [[['id_NFC', '=', datos["nfc"]]]],
                             {'fields': ['nombre', 'apellidos', 'curso'], 'limit':1})
        return jsonify({
            'status': 'exito',
            'resultado_calculado': resultado,
            'mensaje': 'Búsqueda correcta'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route('/create', methods=['POST'])
def crear_registro():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    datos = request.get_json()
    tipo = datos.get('tipo', 'alumno')
    
    # VALIDACIONES COMUNES
    nombre = datos.get('nombre', '').strip()
    apellidos = datos.get('apellidos', '').strip()
    dni = datos.get('dni', '').strip() if datos.get('dni') else None
    
    # Validar nombre
    es_valido, error = validar_nombre(nombre)
    if not es_valido:
        return jsonify({'status': 'error', 'mensaje': f'Nombre inválido: {error}'}), 400
    
    # Validar apellidos
    es_valido, error = validar_nombre(apellidos)
    if not es_valido:
        return jsonify({'status': 'error', 'mensaje': f'Apellidos inválidos: {error}'}), 400
    
    # Validar DNI si se proporciona
    if dni:
        es_valido, error = validar_dni(dni)
        if not es_valido:
            return jsonify({'status': 'error', 'mensaje': f'DNI inválido: {error}'}), 400
    
    if tipo == 'profesor':
        modelo = 'acceso_ies.profesor'
        
        # Validar departamento
        departamento = datos.get('departamento')
        if not departamento:
            return jsonify({'status': 'error', 'mensaje': 'El departamento es obligatorio para profesores'}), 400
        
        vals = {
            'nombre': nombre,
            'apellidos': apellidos,
            'dni': dni,
            'id_NFC': datos.get('id_NFC'),
            'departamento': departamento
        }
    else:
        modelo = 'acceso_ies.estudiante'
        
        # Validar curso
        curso = datos.get('curso')
        if not curso:
            return jsonify({'status': 'error', 'mensaje': 'El curso es obligatorio para estudiantes'}), 400
        
        # Validar fecha de nacimiento
        fecha_nacimiento = datos.get('fecha_nacimiento')
        es_valido, error = validar_fecha_nacimiento(fecha_nacimiento)
        if not es_valido:
            return jsonify({'status': 'error', 'mensaje': f'Fecha de nacimiento inválida: {error}'}), 400
        
        vals = {
            'nombre': nombre,
            'apellidos': apellidos,
            'dni': dni,
            'fecha_nacimiento': fecha_nacimiento,
            'id_NFC': datos.get('id_NFC'),
            'curso': curso
        }
        
    datos_limpios = limpiar_datos(vals)
    
    try:
        nuevo_id = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'create', [datos_limpios])
        return jsonify({'status': 'exito', 'mensaje': f'Registro creado con ID: {nuevo_id}'}), 201
    except Exception as e:
        print(f"Error en Odoo al crear {tipo}: {e}")
        error_msg = str(e)
        # Mensajes de error más amigables
        if 'nfc' in error_msg.lower() and 'unique' in error_msg.lower():
            return jsonify({'status': 'error', 'mensaje': 'El código NFC ya está asignado a otra persona'}), 409
        return jsonify({'status': 'error', 'mensaje': f'Error al guardar en Odoo: {error_msg}'}), 500

@app.route('/api/actualizar_estado', methods=['POST'])
def actualizar_estado():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    
    id_persona = datos.get('id')
    tipo = datos.get('tipo', 'alumno')
    campo = datos.get('campo')
    valor = datos.get('valor')
    
    modelo = 'acceso_ies.estudiante' if tipo == 'alumno' else 'acceso_ies.profesor'
    
    try:
        ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'write', [[id_persona], {campo: valor}])
        return jsonify({'status': 'success', 'mensaje': f'Estado {campo} actualizado correctamente'})
    except Exception as e:
        print(f"Error actualizando estado en Odoo: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/api/actualizar', methods=['PUT', 'POST'])
def actualizar_persona():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    
    id_persona = datos.get('id')
    tipo = datos.get('tipo', 'alumno')
    
    if not id_persona:
        return jsonify({'status': 'error', 'mensaje': 'Se requiere el ID de la persona'}), 400
    
    modelo = 'acceso_ies.estudiante' if tipo == 'alumno' else 'acceso_ies.profesor'
    
    # Validaciones
    nombre = datos.get('nombre', '').strip()
    apellidos = datos.get('apellidos', '').strip()
    dni = datos.get('dni', '').strip()
    
    # Validar nombre
    if nombre and not validar_nombre(nombre):
        return jsonify({'status': 'error', 'mensaje': 'El nombre solo puede contener letras'}), 400
    
    # Validar apellidos
    if apellidos and not validar_nombre(apellidos):
        return jsonify({'status': 'error', 'mensaje': 'Los apellidos solo pueden contener letras'}), 400
    
    # Validar DNI si se proporciona
    if dni and not validar_dni(dni):
        return jsonify({'status': 'error', 'mensaje': 'DNI inválido (formato: 12345678A)'}), 400
    
    # Validar fecha de nacimiento solo para alumnos
    if tipo == 'alumno':
        fecha_nacimiento = datos.get('fecha_nacimiento')
        if fecha_nacimiento and not validar_fecha_nacimiento(fecha_nacimiento):
            return jsonify({'status': 'error', 'mensaje': 'Fecha de nacimiento inválida (edad entre 10 y 80 años)'}), 400
    
    # Preparar datos para actualizar
    valores = {}
    if nombre:
        valores['nombre'] = nombre
    if apellidos:
        valores['apellidos'] = apellidos
    if dni:
        valores['dni'] = dni
    
    if tipo == 'alumno':
        if 'curso' in datos:
            valores['curso'] = datos['curso']
        if 'fecha_nacimiento' in datos:
            valores['fecha_nacimiento'] = datos['fecha_nacimiento']
    else:  # profesor
        if 'departamento' in datos:
            valores['departamento'] = datos['departamento']
    
    if 'id_NFC' in datos:
        valores['id_NFC'] = datos.get('id_NFC', '')
    
    try:
        ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'write', [[id_persona], valores])
        return jsonify({'status': 'success', 'mensaje': f'{tipo.capitalize()} actualizado correctamente'})
    except Exception as e:
        print(f"Error actualizando {tipo} en Odoo: {e}")
        error_msg = str(e)
        if 'nfc' in error_msg.lower() and 'unique' in error_msg.lower():
            return jsonify({'status': 'error', 'mensaje': 'El código NFC ya está asignado a otra persona'}), 409
        return jsonify({'status': 'error', 'mensaje': f'Error al actualizar: {error_msg}'}), 500

@app.route('/Borrar_Usuario', methods=['DELETE'])
def borrar_usuario():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión a Odoo'}), 500
    datos = request.get_json()

    if not datos or "nfc" not in datos:
        return jsonify({'status': 'error', 'mensaje': 'Se requiere el campo "nfc" para borrar el usuario'}), 400

    tipo = datos.get('tipo', 'alumno')
    modelo = 'acceso_ies.profesor' if tipo == 'profesor' else 'acceso_ies.estudiante'

    try:
        user_ids = ejecutar_odoo_kw(DB, uid, PASSWORD,
                                     modelo, 'search',
                                     [[['id_NFC', '=', datos["nfc"]]]])
        
        if not user_ids:
            return jsonify({'status': 'error', 'mensaje': f'No se encontró ningún {tipo} con ese NFC'}), 404
            
        resultado = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'unlink', [user_ids])
        
        if resultado:
            return jsonify({'status': 'exito', 'mensaje': f'Usuario ({tipo}) borrado correctamente'})
        else:
            return jsonify({'status': 'error', 'mensaje': 'Odoo denegó el borrado del usuario'}), 500

    except Exception as e:
        print(f"Error borrando usuario en Odoo: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/api/borrar_persona', methods=['DELETE', 'POST', 'OPTIONS'])
def borrar_persona():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión a Odoo'}), 500
    datos = request.get_json()

    if not datos:
        return jsonify({'status': 'error', 'mensaje': 'No se recibieron datos'}), 400

    tipo = datos.get('tipo', 'alumno')
    modelo = 'acceso_ies.profesor' if tipo == 'profesor' else 'acceso_ies.estudiante'

    try:
        # Aceptar tanto 'id' directo como 'nfc' para buscar
        if 'id' in datos:
            # Usar el ID directamente
            user_id = datos['id']
            # Verificar que existe
            existe = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'search', [[['id', '=', user_id]]])
            if not existe:
                return jsonify({'status': 'error', 'mensaje': f'No se encontró {tipo} con ID {user_id}'}), 404
            user_ids = [user_id]
        elif 'nfc' in datos:
            # Buscar por NFC
            user_ids = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'search', [[['id_NFC', '=', datos["nfc"]]]])
            if not user_ids:
                return jsonify({'status': 'error', 'mensaje': f'No se encontró ningún {tipo} con ese NFC'}), 404
        else:
            return jsonify({'status': 'error', 'mensaje': 'Se requiere el campo "id" o "nfc" para borrar'}), 400

        resultado = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'unlink', [user_ids])

        if resultado:
            return jsonify({'status': 'exito', 'mensaje': f'Persona ({tipo}) borrada correctamente'})
        else:
            return jsonify({'status': 'error', 'mensaje': 'Odoo denegó el borrado de la persona'}), 500

    except Exception as e:
        print(f"Error borrando persona en Odoo: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/Salida_Recreo', methods=['POST'])
def salida_recreo():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        user = ejecutar_odoo_kw(DB, uid, PASSWORD,
                                 'acceso_ies.estudiante', 'search_read',
                                 [[['id_NFC', '=', datos["nfc"]]]],
                                 {'fields': ['id', 'nombre','apellidos', 'recreo', 'fecha_nacimiento', 'curso'], 'limit':1})
        
        if user and user[0].get("fecha_nacimiento"):
            fecha = datetime.strptime(user[0]['fecha_nacimiento'], '%Y-%m-%d')
            hoy = datetime.now()
            
            edad = hoy.year - fecha.year - ((hoy.month, hoy.day) < (fecha.month, fecha.day))
            
            nuevo_estado = True if edad >= 18 else False
            
            ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'write', 
                              [[user[0]['id']], {'recreo': nuevo_estado}])
            
            user[0]['recreo'] = nuevo_estado
            return jsonify({"status": "success", "data": user})
        
        return jsonify({"status": "error", "data": "Usuario no encontrado o sin fecha"})
    except Exception as e:
        return jsonify({"status": "error", "data": str(e)})

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    tipo = request.args.get('tipo', 'alumnos')
    
    try:
        if tipo == 'profesores':
            modelo = 'acceso_ies.profesor'
            modelo_asistencia = 'acceso_ies.asistencia_profesor'
            campos = ['id', 'nombre', 'apellidos', 'departamento', 'id_NFC', 'recreo', 'salida_anticipada']
        else:
            modelo = 'acceso_ies.estudiante'
            modelo_asistencia = 'acceso_ies.asistencia_estudiante'
            campos = ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'recreo', 'salida_anticipada']

        try:
            personas = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'search_read', [[]], {'fields': campos})
        except Exception:
            campos_basicos = ['id', 'nombre', 'apellidos', 'departamento', 'id_NFC'] if tipo == 'profesores' else ['id', 'nombre', 'apellidos', 'curso', 'id_NFC']
            personas = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'search_read', [[]], {'fields': campos_basicos})

        incidencias = sum(1 for p in personas if not p.get('id_NFC'))
        total_salidas_hoy = sum(1 for p in personas if p.get('salida_anticipada', False))
        
        data_personas = []
        for p in personas:
            nombre_completo = f"{p.get('nombre', '')} {p.get('apellidos', '')}".strip()
            
            data_personas.append({
                "id": p['id'], 
                "name": nombre_completo, 
                "curso": p.get('curso'),
                "departamento": p.get('departamento'),
                "nfc_id": p.get('id_NFC') if p.get('id_NFC') else None,
                "recreo": p.get('recreo', False), 
                "salida_anticipada": p.get('salida_anticipada', False)
            })

        hoy = datetime.now()
        inicio_semana = hoy - timedelta(days=hoy.weekday())
        inicio_semana = inicio_semana.replace(hour=0, minute=0, second=0, microsecond=0)
        inicio_semana_str = inicio_semana.strftime('%Y-%m-%d %H:%M:%S')

        conteo_semana = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
        etiquetas_dias = {0: "L", 1: "M", 2: "X", 3: "J", 4: "V"}
        
        try:
            asistencias_semana = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo_asistencia, 'search_read',
                [[('fecha', '>=', inicio_semana_str)]],
                {'fields': ['fecha']}
            )
            for asis in asistencias_semana:
                fecha_str = asis.get('fecha')
                if fecha_str:
                    fecha_dt = datetime.strptime(fecha_str, '%Y-%m-%d %H:%M:%S')
                    dia_semana = fecha_dt.weekday()
                    if dia_semana in conteo_semana:
                        conteo_semana[dia_semana] += 1
        except Exception as e:
            print(f"Aviso: No se pudo obtener la estadística semanal (¿Creaste el campo 'fecha'?): {e}")

        datos_semana_grafico = [
            {"label": etiquetas_dias[i], "total": conteo_semana[i]} for i in range(5)
        ]

        return jsonify({
            "data": data_personas,
            "stats": {
                "total_hoy": total_salidas_hoy,
                "incidencias": incidencias, 
                "sync": 100, 
                "fecha": datetime.now().strftime("%d %b")
            },
            "semana": datos_semana_grafico
        })
    except Exception as e:
        print(f"Error cargando dashboard: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/api/alumnado', methods=['GET'])
def get_alumnado_completo():
    if not uid: return jsonify({'status': 'error'}), 500
    try:
        estudiantes = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'dni', 'fecha_nacimiento', 'recreo', 'salida_anticipada']})
        return jsonify({"status": "success", "data": estudiantes})
    except Exception as e:
        estudiantes = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', [[]], {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'dni', 'fecha_nacimiento']})
        return jsonify({"status": "success", "data": estudiantes})

@app.route('/api/profesorado', methods=['GET'])
def get_profesorado():
    if not uid: return jsonify({'status': 'error'}), 500
    try:
        profesorado = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.profesor', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'dni', 'departamento', 'id_NFC']})
        return jsonify({"status": "success", "data": profesorado})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)})

@app.route('/api/vincular_nfc', methods=['POST'])
def vincular_nfc():
    if not uid: 
        return jsonify({'status': 'error', 'mensaje': 'No hay sesión de Odoo activa'}), 401

    datos = request.get_json()
    
    if not datos:
        return jsonify({'status': 'error', 'mensaje': 'No se enviaron datos JSON'}), 400

    registro_id = datos.get('id')
    nfc = datos.get('nfc')
    tipo = datos.get('tipo', 'alumnos')

    if not registro_id or not str(nfc).strip():
        return jsonify({'status': 'error', 'mensaje': 'Los campos "id" y "nfc" son obligatorios'}), 400

    try:
        registro_id = int(registro_id)
    except ValueError:
        return jsonify({'status': 'error', 'mensaje': 'El campo "id" debe ser un número entero válido'}), 400

    if tipo not in ['alumnos', 'profesores']:
        return jsonify({'status': 'error', 'mensaje': 'El "tipo" debe ser "alumnos" o "profesores"'}), 400

    modelo_actual = 'acceso_ies.profesor' if tipo == 'profesores' else 'acceso_ies.estudiante'
    modelo_contrario = 'acceso_ies.estudiante' if tipo == 'profesores' else 'acceso_ies.profesor'
    nombre_contrario = 'alumno' if tipo == 'profesores' else 'profesor'

    try:
        nfc_en_actual = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo_actual, 'search', 
                                          [[('id_NFC', '=', nfc)]])
        
        if nfc_en_actual:
            if registro_id in nfc_en_actual:
                return jsonify({'status': 'success', 'mensaje': 'Esta tarjeta ya estaba vinculada a este usuario'}), 200
            else:
                return jsonify({'status': 'error', 'mensaje': f'El NFC ya está asignado a otro {tipo[:-1]}'}), 409

        nfc_en_contrario = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo_contrario, 'search', 
                                             [[('id_NFC', '=', nfc)]])
        
        if nfc_en_contrario:
            return jsonify({'status': 'error', 'mensaje': f'El NFC ya está asignado a un {nombre_contrario}'}), 409

        resultado = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo_actual, 'write', 
                                      [[registro_id], {'id_NFC': nfc}])
        
        if resultado:
            return jsonify({'status': 'success', 'mensaje': 'Vinculado correctamente'}), 200
        else:
            return jsonify({'status': 'error', 'mensaje': 'No se encontró el registro o no se pudo actualizar'}), 404
            
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': f'Error al comunicar con Odoo: {str(e)}'}), 500
    
@app.route("/AsistenciaProfesor", methods=['POST'])
def Asistencia_profesor():
    try:
        datos = request.get_json()
        nfc_id = datos.get("id_NFC")
        
        estado_bruto = str(datos.get("estado_asistencia", "")).lower()
        if "entrada" in estado_bruto or "llego" in estado_bruto:
            estado_asistencia = "llego al centro"
        elif "salida" in estado_bruto or "salio" in estado_bruto:
            estado_asistencia = "salio del centro"
        else:
            estado_asistencia = estado_bruto

        profesor = ejecutar_odoo_kw(DB, uid, PASSWORD,
                                 'acceso_ies.profesor', 'search_read',
                                 [[['id_NFC', '=', nfc_id]]],
                                 {'fields': ['id', 'nombre'], 'limit': 1})
        
        if not profesor:
            return jsonify({'status': 'error', 'mensaje': 'Tarjeta NFC no registrada en el sistema.'})

        profesor_encontrado = profesor[0]
        nombre_profe = profesor_encontrado.get("nombre", "El profesor")
        
        # Generamos la hora actual UTC para el campo nuevo 'fecha'
        ahora_utc = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        
        datos_para_odoo = {
            "estado_asistencia": estado_asistencia,
            "profesor_id": profesor_encontrado["id"],
            "fecha": ahora_utc
        }

        try:
            nuevo_registro_id = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_profesor', 'create', [[datos_para_odoo]])
        except Exception as error_odoo:
            return jsonify({'status': 'error', 'mensaje': f"Odoo rechazó el registro: {str(error_odoo)}"}), 500
            
        if estado_asistencia == "llego al centro":
            return jsonify({
                'status': 'success',
                'mensaje': f'Asistencia registrada para {nombre_profe}',
                'registro_id': nuevo_registro_id
            }), 201
        else:
            return jsonify({
                'status': 'success',
                'mensaje': f'Salida registrada para {nombre_profe}',
                'registro_id': nuevo_registro_id
            }), 201
            
    except Exception as e:
        print(e)
        return jsonify({'status': 'error', 'mensaje': f"Fallo del servidor: {str(e)}"}), 500

@app.route("/AsistenciaEstudiante", methods=['POST'])
def Asistencia_estudiante():
    datos = request.get_json()
    
    try:
        nfc_id = datos.get("id_NFC")
        
        estado_bruto = str(datos.get("estado_asistencia", "")).lower()
        if "tarde" in estado_bruto or "entrada" in estado_bruto:
            estado_asistencia = "llego tarde" 
        elif "salida" in estado_bruto or "anticipada" in estado_bruto:
            estado_asistencia = "salida anticipada"
        else:
            estado_asistencia = estado_bruto

        estudiantes = ejecutar_odoo_kw(DB, uid, PASSWORD,
                                 'acceso_ies.estudiante', 'search_read',
                                 [[['id_NFC', '=', nfc_id]]],
                                 {'fields': ['id', 'nombre', 'salida_anticipada'], 'limit': 1})
        
        if not estudiantes:
            return jsonify({'status': 'error', 'mensaje': 'Tarjeta NFC no registrada en el sistema.'}), 404

        estudiante_encontrado = estudiantes[0]
        nombre_alumno = estudiante_encontrado.get("nombre", "El estudiante")
        
        if estado_asistencia == "salida anticipada":
            if estudiante_encontrado.get("salida_anticipada") == False:
                return jsonify({'status': 'error', 'mensaje': f'{nombre_alumno} no tiene permisos para salir'}), 404
        
        # Generamos la hora actual UTC para el campo nuevo 'fecha'
        ahora_utc = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        
        datos_para_odoo = {
            "estado_asistencia": estado_asistencia,
            "estudiante_id": estudiante_encontrado["id"],
            "fecha": ahora_utc
        }

        try:
            nuevo_registro_id = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_estudiante', 'create', [[datos_para_odoo]])
        except Exception as error_odoo:
            return jsonify({'status': 'error', 'mensaje': f"Odoo DB Error: {str(error_odoo)}"}), 500
        
        texto_registro = "Llegada tarde" if estado_asistencia == "llego tarde" else "Salida"
        
        return jsonify({
            'status': 'success', 
            'mensaje': f'{texto_registro} registrada para {nombre_alumno}',
            'registro_id': nuevo_registro_id
        }), 201

    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': f"Error interno del servidor: {str(e)}"}), 500

@app.route('/GetProfesor', methods=['POST'])
def get_profesor():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        print(datos)
        resultado = ejecutar_odoo_kw(DB, uid, PASSWORD,
                             'acceso_ies.profesor', 'search_read',
                             [[['id_NFC', '=', datos["nfc"]]]],
                             {'fields': ['nombre', 'apellidos'], 'limit':1})
        
        if not resultado:
           return jsonify({'status': 'error', 'data': 'Tarjeta NFC no registrada en el sistema.'}), 404
        
        return jsonify({
            'status': 'success',
            'data': resultado,
            'mensaje': 'Búsqueda correcta'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'data': str(e)})

@app.route('/api/asistencia', methods=['GET'])
def get_asistencia():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión a Odoo'}), 500
    
    filtro = request.args.get('filtro', 'todos')
    fecha = request.args.get('fecha')
    search_domain = []
    
    if fecha:
        inicio_dia = f"{fecha} 00:00:00"
        fin_dia = f"{fecha} 23:59:59"
        search_domain = [('fecha', '>=', inicio_dia), ('fecha', '<=', fin_dia)]
    
    data_formateada = []
    limite = 200 if fecha else 50
    
    def procesar_registros(registros, campo_id, colectivo, default_tipo):
        for reg in registros:
            nombre = "Desconocido"
            if reg.get(campo_id):
                if isinstance(reg[campo_id], list) and len(reg[campo_id]) > 1:
                    nombre = reg[campo_id][1]
                else:
                    nombre = str(reg[campo_id])

            tipo = reg.get('estado_asistencia', default_tipo) 
            
            # Priorizamos tu nuevo campo 'fecha'. Si está vacío, pillamos el viejo 'create_date'
            hora_cruda = reg.get('fecha') or reg.get('create_date', '--')
            hora_formateada = hora_cruda
            
            if hora_cruda != '--':
                try:
                    dt = datetime.strptime(hora_cruda, '%Y-%m-%d %H:%M:%S')
                    hora_formateada = dt.strftime('%d/%m/%Y %H:%M')
                except:
                    pass

            data_formateada.append({
                "nombre": nombre,
                "colectivo": colectivo,
                "tipo": tipo,
                "hora": hora_formateada,
                "raw_date": hora_cruda,
                "notas": "Registrado por NFC / CSV"
            })

    try:
        if filtro in ['todos', 'alumnos']:
            registros_alumnos = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_estudiante', 
                'search_read', [search_domain],
                {'fields': ['estudiante_id', 'estado_asistencia', 'create_date', 'fecha'], 'order': 'fecha desc', 'limit': limite})
            procesar_registros(registros_alumnos, 'estudiante_id', 'alumno', 'llegada_tarde')

        if filtro in ['todos', 'profesores']:
            registros_profes = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_profesor', 
                'search_read', [search_domain],
                {'fields': ['profesor_id', 'estado_asistencia', 'create_date', 'fecha'], 'order': 'fecha desc', 'limit': limite})
            procesar_registros(registros_profes, 'profesor_id', 'profesor', 'salida_anticipada')

        data_formateada = sorted(data_formateada, key=lambda x: str(x.get('raw_date', '')), reverse=True)
        for item in data_formateada: item.pop('raw_date', None)

        return jsonify({"status": "success", "data": data_formateada})
        
    except Exception as e:
        print(f"Error al obtener asistencia de Odoo: {e}")
        return jsonify({"status": "error", "mensaje": str(e)})

@app.route('/api/importar_asistencia', methods=['POST'])
def importar_asistencia():
    if not uid: 
        return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    datos_peticion = request.get_json()
    incidencias = datos_peticion.get('datos', [])
    
    if not incidencias:
        return jsonify({'status': 'error', 'mensaje': 'No hay datos para importar'}), 400
        
    exitosos = 0
    errores = []

    try:
        estudiantes = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', [[]], {'fields': ['id', 'nombre', 'apellidos']})
        profesores = ejecutar_odoo_kw(DB, uid, PASSWORD, 'acceso_ies.profesor', 'search_read', [[]], {'fields': ['id', 'nombre', 'apellidos']})
        
        def generar_nombre_completo(p):
            nom = p.get('nombre') if isinstance(p.get('nombre'), str) else ''
            ape = p.get('apellidos') if isinstance(p.get('apellidos'), str) else ''
            return f"{nom} {ape}".strip().lower()
        
        mapa_estudiantes = {generar_nombre_completo(e): e['id'] for e in estudiantes}
        mapa_profesores = {generar_nombre_completo(p): p['id'] for p in profesores}
        
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': f'Error cargando datos base: {str(e)}'}), 500

    for idx, inc in enumerate(incidencias):
        nombre_csv = inc.get('nombre', '').strip().lower()
        colectivo_csv = inc.get('colectivo', '').strip().lower()
        tipo_csv = inc.get('tipo', '').strip().lower()
        
        hora_csv = inc.get('hora', '').strip() 
        
        es_alumno = 'alumno' in colectivo_csv
        estado_asistencia = ""
        
        if es_alumno:
            if "tarde" in tipo_csv:
                estado_asistencia = "llego tarde"
            else:
                estado_asistencia = "salida anticipada"
        else:
            if "salida" in tipo_csv or "anticipada" in tipo_csv:
                estado_asistencia = "salio del centro"
            else:
                estado_asistencia = "llego al centro"

        persona_id = None
        modelo = ''
        campo_id = ''
        
        if es_alumno:
            modelo = 'acceso_ies.asistencia_estudiante'
            campo_id = 'estudiante_id'
            
            persona_id = mapa_estudiantes.get(nombre_csv)
            if not persona_id:
                for nombre_bd, id_bd in mapa_estudiantes.items():
                    if nombre_csv in nombre_bd or nombre_bd in nombre_csv:
                        persona_id = id_bd
                        break
        else:
            modelo = 'acceso_ies.asistencia_profesor'
            campo_id = 'profesor_id'
            
            persona_id = mapa_profesores.get(nombre_csv)
            if not persona_id:
                for nombre_bd, id_bd in mapa_profesores.items():
                    if nombre_csv in nombre_bd or nombre_bd in nombre_csv:
                        persona_id = id_bd
                        break
                        
        if not persona_id:
            errores.append(f"No encontrado en Odoo: {inc.get('nombre')}")
            continue
            
        # Parseamos la fecha del CSV
        fecha_odoo = None
        if hora_csv and hora_csv != '--':
            try:
                if hora_csv.count(':') == 1:
                    dt = datetime.strptime(hora_csv, '%d/%m/%Y %H:%M')
                else:
                    dt = datetime.strptime(hora_csv, '%d/%m/%Y %H:%M:%S')
                fecha_odoo = dt.strftime('%Y-%m-%d %H:%M:%S')
            except ValueError:
                pass

        datos_odoo = {
            campo_id: persona_id,
            'estado_asistencia': estado_asistencia,
        }
        
        # Le enviamos la fecha directamente al nuevo campo
        if fecha_odoo:
            datos_odoo['fecha'] = fecha_odoo
        
        try:
            nuevo_id = ejecutar_odoo_kw(DB, uid, PASSWORD, modelo, 'create', [[datos_odoo]])
            exitosos += 1
        except Exception as e:
            errores.append(f"Odoo rechazó a {inc.get('nombre')} (Estado intentado: {estado_asistencia}): {str(e)}")

    mensaje = f"Importados {exitosos} registros correctamente."
    status = 'success'
    
    if errores:
        print("--- ERRORES DE IMPORTACIÓN ---")
        for err in errores: print(err)
        
        if exitosos == 0:
            status = 'error'
            mensaje = f"Fallo al importar. Verifica los estados en la consola."
        else:
            mensaje += f" ({len(errores)} fallaron. Mira la consola de Python)."
        
    return jsonify({'status': status, 'mensaje': mensaje, 'exitosos': exitosos, 'errores': errores})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
    