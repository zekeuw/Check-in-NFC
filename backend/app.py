from flask import Flask, request, jsonify
from flask_cors import CORS
import xmlrpc.client
from datetime import datetime, timedelta

URL = 'http://localhost:8072'
DB = 'Servidor_proyecto'
USERNAME = 'admin'
PASSWORD = 'admin'

try:
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USERNAME, PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)
    
    if uid:
        print(f"Conexión exitosa con Odoo. UID: {uid}")
    else:
        print("Error de autenticación con Odoo.")
except Exception as e:
    print(f"Error de conexión inicial: {e}")
    uid = None

app = Flask(__name__)
CORS(app)

def limpiar_datos(datos):
    """Convierte strings vacíos en None para evitar errores en Odoo."""
    for clave, valor in datos.items():
        if valor == "":
            datos[clave] = None
    return datos

@app.route('/procesar-datos', methods=['POST'])
def ejecutar_funcion():
    """Busca estudiante por NFC (Lógica original)."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        resultado = models.execute_kw(DB, uid, PASSWORD,
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
    """Crea un alumno o profesor dependiendo del tipo enviado desde la web."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    datos = request.get_json()
    tipo = datos.get('tipo', 'alumno')
    
    if tipo == 'profesor':
        modelo = 'acceso_ies.profesor'
        vals = {
            'nombre': datos.get('nombre'),
            'apellidos': datos.get('apellidos'),
            'dni': datos.get('dni'),
            'id_NFC': datos.get('id_NFC'),
            'departamento': datos.get('departamento')
        }
    else:
        modelo = 'acceso_ies.estudiante'
        vals = {
            'nombre': datos.get('nombre'),
            'apellidos': datos.get('apellidos'),
            'dni': datos.get('dni'),
            'fecha_nacimiento': datos.get('fecha_nacimiento'),
            'id_NFC': datos.get('id_NFC'),
            'curso': datos.get('curso')
        }
        
    datos_limpios = limpiar_datos(vals)
    
    try:
        nuevo_id = models.execute_kw(DB, uid, PASSWORD, modelo, 'create', [datos_limpios])
        return jsonify({'status': 'exito', 'mensaje': f'Registro creado con ID: {nuevo_id}'})
    except Exception as e:
        print(f"Error en Odoo al crear {tipo}: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route('/api/actualizar_estado', methods=['POST'])
def actualizar_estado():
    """Ruta unificada para actualizar salida anticipada y recreo desde los botones."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    
    id_persona = datos.get('id')
    tipo = datos.get('tipo', 'alumno')
    campo = datos.get('campo') # Puede ser 'recreo' o 'salida_anticipada'
    valor = datos.get('valor') # True o False
    
    modelo = 'acceso_ies.estudiante' if tipo == 'alumno' else 'acceso_ies.profesor'
    
    try:
        models.execute_kw(DB, uid, PASSWORD, modelo, 'write', [[id_persona], {campo: valor}])
        return jsonify({'status': 'success', 'mensaje': f'Estado {campo} actualizado correctamente'})
    except Exception as e:
        print(f"Error actualizando estado en Odoo: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/Salida_Recreo', methods=['POST'])
def salida_recreo():
    """Lógica de validación por edad."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        user = models.execute_kw(DB, uid, PASSWORD,
                                 'acceso_ies.estudiante', 'search_read',
                                 [[['id_NFC', '=', datos["nfc"]]]],
                                 {'fields': ['nombre','apellidos', 'recreo', 'fecha_nacimiento', 'curso'], 'limit':1})
        
        if user and user[0].get("fecha_nacimiento"):
            fecha = datetime.strptime(user[0]['fecha_nacimiento'], '%Y-%m-%d')
            if datetime.now() - fecha < timedelta(days=365*18):
                user[0]['recreo'] = False
            else:
                user[0]['recreo'] = True
            return jsonify({"status": "success", "data": user})
        
        return jsonify({"status": "error", "data": "Usuario no encontrado o sin fecha"})
    except Exception as e:
        return jsonify({"status": "error", "data": str(e)})

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """Obtiene los datos del dashboard filtrando por alumnos o profesores."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    tipo = request.args.get('tipo', 'alumnos')
    
    try:
        if tipo == 'profesores':
            modelo = 'acceso_ies.profesor'
            campos = ['id', 'nombre', 'apellidos', 'departamento', 'id_NFC', 'recreo', 'salida_anticipada']
        else:
            modelo = 'acceso_ies.estudiante'
            campos = ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'recreo', 'salida_anticipada']

        # Omitimos errores si los profesores no tienen los campos recreo/salida_anticipada configurados aún
        try:
            personas = models.execute_kw(DB, uid, PASSWORD, modelo, 'search_read', [[]], {'fields': campos})
        except Exception:
            # Fallback en caso de que el modelo profesor no tenga recreo/salida
            campos_basicos = ['id', 'nombre', 'apellidos', 'departamento', 'id_NFC'] if tipo == 'profesores' else ['id', 'nombre', 'apellidos', 'curso', 'id_NFC']
            personas = models.execute_kw(DB, uid, PASSWORD, modelo, 'search_read', [[]], {'fields': campos_basicos})

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

        return jsonify({
            "data": data_personas,
            "stats": {
                "total_hoy": total_salidas_hoy,
                "incidencias": incidencias, 
                "sync": 100, 
                "fecha": datetime.now().strftime("%d %b")
            },
            # Datos simulados para Chart.js (Puedes cambiar esto para que haga un count real en la base de datos)
            "semana": [
                {"label": "L", "total": 12}, 
                {"label": "M", "total": 8}, 
                {"label": "X", "total": 15}, 
                {"label": "J", "total": 20}, 
                {"label": "V", "total": total_salidas_hoy} 
            ]
        })
    except Exception as e:
        print(f"Error cargando dashboard: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/api/alumnado', methods=['GET'])
def get_alumnado_completo():
    if not uid: return jsonify({'status': 'error'}), 500
    try:
        estudiantes = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'dni', 'fecha_nacimiento', 'recreo', 'salida_anticipada']})
        return jsonify({"status": "success", "data": estudiantes})
    except Exception as e:
        # Fallback si no existen los campos de recreo en Odoo
        estudiantes = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', [[]], {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'dni', 'fecha_nacimiento']})
        return jsonify({"status": "success", "data": estudiantes})

@app.route('/api/profesorado', methods=['GET'])
def get_profesorado():
    if not uid: return jsonify({'status': 'error'}), 500
    try:
        profesorado = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.profesor', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'dni', 'departamento', 'id_NFC']})
        return jsonify({"status": "success", "data": profesorado})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)})

@app.route('/api/vincular_nfc', methods=['POST'])
def vincular_nfc():
    if not uid: return jsonify({'status': 'error'}), 500
    datos = request.get_json()
    tipo = datos.get('tipo', 'alumnos')
    
    modelo = 'acceso_ies.profesor' if tipo == 'profesores' else 'acceso_ies.estudiante'
    
    try:
        models.execute_kw(DB, uid, PASSWORD, modelo, 'write', 
                          [[int(datos['id'])], {'id_NFC': datos.get('nfc')}])
        return jsonify({'status': 'success', 'mensaje': 'Vinculado correctamente'})
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route("/AsistenciaProfesor", methods=['POST'])
def Asistencia_profesor():
    try:
        datos = request.get_json()
        nfc_id = datos.get("id_NFC")
        estado_asistencia = datos.get("estado_asistencia")

        profesor = models.execute_kw(DB, uid, PASSWORD,
                                 'acceso_ies.profesor', 'search_read',
                                 [[['id_NFC', '=', nfc_id]]],
                                 {'fields': ['id', 'nombre'], 'limit': 1})
        
        if not profesor:
            return jsonify({'status': 'error', 'mensaje': 'Tarjeta NFC no registrada en el sistema.'})

        profesor_encontrado = profesor[0]
        
        datos_para_odoo = {
            "estado_asistencia": estado_asistencia,
            "profesor_id": profesor_encontrado["id"]
        }

        nuevo_registro_id = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_profesor', 'create', [[datos_para_odoo]])
        if estado_asistencia == "llego al centro":
            
            return jsonify({
                'status': 'success',
                'mensaje': f'Asistencia registrada para {profesor_encontrado["nombre"]}',
                'registro_id': nuevo_registro_id
            }), 201
        else:
            return jsonify({
                'status': 'success',
                'mensaje': f'Salida registrada para {profesor_encontrado["nombre"]}',
                'registro_id': nuevo_registro_id
            }), 201
            

    except Exception as e:
        print(e)
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route("/AsistenciaEstudiante", methods=['POST'])
def Asistencia_estudiante():
    datos = request.get_json()
    
    try:
        nfc_id = datos.get("id_NFC")
        estado_asistencia = datos.get("estado_asistencia")

        estudiantes = models.execute_kw(DB, uid, PASSWORD,
                                 'acceso_ies.estudiante', 'search_read',
                                 [[['id_NFC', '=', nfc_id]]],
                                 {'fields': ['id', 'nombre', 'salida_anticipada'], 'limit': 1})
        
        if not estudiantes:
            return jsonify({'status': 'error', 'mensaje': 'Tarjeta NFC no registrada en el sistema.'}), 404

        estudiante_encontrado = estudiantes[0]
        print(estudiante_encontrado)
        if estudiante_encontrado["salida_anticipada"] == False:
            return jsonify({'status': 'error', 'mensaje': 'El estudiante no tiene permisos para salir'}), 404
        
        datos_para_odoo = {
            "estado_asistencia": estado_asistencia,
            "estudiante_id": estudiante_encontrado["id"] 
        }

        nuevo_registro_id = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_estudiante', 'create', [[datos_para_odoo]])
        
        return jsonify({
            'status': 'success', 
            'mensaje': f'Asistencia registrada para {estudiante_encontrado["nombre"]}',
            'registro_id': nuevo_registro_id
        }), 201

    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': "Usuario no encontrado"}), 500

@app.route('/GetProfesor', methods=['GET'])
def get_profesor():
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    datos = request.get_json()
    try:
        resultado = models.execute_kw(DB, uid, PASSWORD,
                             'acceso_ies.profesor', 'search_read',
                             [[['id_NFC', '=', datos["nfc"]]]],
                             {'fields': ['nombre', 'apellidos'], 'limit':1})
        if not resultado:
           return jsonify({'status': 'error', 'mensaje': 'Tarjeta NFC no registrada en el sistema.'}), 404
        
        return jsonify({
            'status': 'success',
            'resultado_calculado': resultado,
            'mensaje': 'Búsqueda correcta'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

    
@app.route('/api/asistencia', methods=['GET'])
def get_asistencia():
    if not uid: 
        return jsonify({'status': 'error', 'mensaje': 'Sin conexión a Odoo'}), 500
    
    filtro = request.args.get('filtro', 'todos')
    data_formateada = []
    
    try:
        if filtro in ['todos', 'alumnos']:
            registros_alumnos = models.execute_kw(
                DB, uid, PASSWORD, 
                'acceso_ies.asistencia_estudiante', 
                'search_read', 
                [[]], 
                {
                    'fields': ['estudiante_id', 'estado_asistencia', 'create_date'], 
                    'order': 'create_date desc', 
                    'limit': 50 
                }
            )
            
            for reg in registros_alumnos:
                nombre = "Desconocido"
                if reg.get('estudiante_id'):
                    if isinstance(reg['estudiante_id'], list) and len(reg['estudiante_id']) > 1:
                        nombre = reg['estudiante_id'][1]
                    else:
                        nombre = str(reg['estudiante_id'])

                tipo = reg.get('estado_asistencia', 'llegada_tarde') 
                
                hora_cruda = reg.get('create_date', '--')
                hora_formateada = hora_cruda
                if hora_cruda != '--':
                    try:
                        dt = datetime.strptime(hora_cruda, '%Y-%m-%d %H:%M:%S')
                        hora_formateada = dt.strftime('%d/%m/%Y %H:%M')
                    except:
                        pass

                data_formateada.append({
                    "nombre": nombre,
                    "colectivo": "alumno",
                    "tipo": tipo,
                    "hora": hora_formateada,
                    "raw_date": hora_cruda,
                    "notas": "Registrado por NFC"
                })

        if filtro in ['todos', 'profesores']:
            try:
                registros_profes = models.execute_kw(
                    DB, uid, PASSWORD, 
                    'acceso_ies.asistencia_profesor', 
                    'search_read', 
                    [[]], 
                    {
                        'fields': ['profesor_id', 'estado_asistencia', 'create_date'], 
                        'order': 'create_date desc', 
                        'limit': 50 
                    }
                )
                
                for reg in registros_profes:
                    nombre = "Desconocido"
                    if reg.get('profesor_id'):
                        if isinstance(reg['profesor_id'], list) and len(reg['profesor_id']) > 1:
                            nombre = reg['profesor_id'][1]
                        else:
                            nombre = str(reg['profesor_id'])
                            
                    tipo = reg.get('estado_asistencia', 'salida_anticipada')
                    hora_cruda = reg.get('create_date', '--')
                    hora_formateada = hora_cruda
                    if hora_cruda != '--':
                        try:
                            dt = datetime.strptime(hora_cruda, '%Y-%m-%d %H:%M:%S')
                            hora_formateada = dt.strftime('%d/%m/%Y %H:%M')
                        except:
                            pass

                    data_formateada.append({
                        "nombre": nombre,
                        "colectivo": "profesor",
                        "tipo": tipo,
                        "hora": hora_formateada,
                        "raw_date": hora_cruda,
                        "notas": "Registrada asistencia por NFC"
                    })
            except Exception as e:
                print(f"Aviso: No se pudo obtener asistencia de profesores. Error: {e}")

        data_formateada = sorted(data_formateada, key=lambda x: x['raw_date'], reverse=True)
        
        for item in data_formateada:
            item.pop('raw_date', None)

        return jsonify({"status": "success", "data": data_formateada})
        
    except Exception as e:
        print(f"Error al obtener asistencia de Odoo: {e}")
        return jsonify({"status": "error", "mensaje": str(e)})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
