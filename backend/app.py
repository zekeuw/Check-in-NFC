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
    """Convierte strings vacíos en None."""
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
    """Crea un alumno incluyendo el campo CURSO."""
    if not uid: return jsonify({'status': 'error', 'mensaje': 'Sin conexión Odoo'}), 500
    
    datos = request.get_json()
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
        nuevo_id = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'create', [datos_limpios])
        return jsonify({'status': 'exito', 'mensaje': f'Registro creado con ID: {nuevo_id}'})
    except Exception as e:
        print(f"Error en Odoo al crear: {e}")
        return jsonify({'status': 'error', 'mensaje': str(e)})

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

@app.route('/api/toggle_recreo', methods=['POST'])
def toggle_recreo():
    datos = request.get_json()
    try:
        models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'write', 
                          [[datos.get('id')], {'recreo': datos.get('recreo')}])
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route('/api/toggle_salida', methods=['POST'])
def toggle_salida():
    datos = request.get_json()
    try:
        models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'write', 
                          [[datos.get('id')], {'salida_anticipada': datos.get('salida')}])
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    if not uid: return jsonify({'status': 'error'}), 500
    try:
        estudiantes = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'recreo', 'salida_anticipada']})
        
        incidencias = sum(1 for estudiante in estudiantes if not estudiante.get('id_NFC'))
        
        total_salidas_hoy = sum(1 for estudiante in estudiantes if estudiante.get('salida_anticipada'))
        
        data_alumnos = []
        for estudiante in estudiantes:
            nombre_completo = f"{estudiante['nombre']} {estudiante['apellidos'] or ''}".strip()
            
            data_alumnos.append({
                "id": estudiante['id'], 
                "name": nombre_completo, 
                "curso": estudiante['curso'] or 'Sin asignar',
                "nfc_id": estudiante['id_NFC'] if estudiante['id_NFC'] else None,
                "recreo": estudiante.get('recreo', False), 
                "salida_anticipada": estudiante.get('salida_anticipada', False)
            })

        return jsonify({
            "alumnos": data_alumnos,
            "stats": {
                "total_hoy": total_salidas_hoy,
                "incidencias": incidencias, 
                "sync": 100, 
                "fecha": datetime.now().strftime("%d %b")
            },
            "semana": [{"label": "L", "total": 45}, {"label": "M", "total": 42}, {"label": "X", "total": 35}, {"label": "J", "total": 48}, {"label": "V", "total": 15, "actual": True}]
        })
    except Exception as e:
        print(e)
        return jsonify({'status': 'error', 'mensaje': str(e)}), 500

@app.route('/api/alumnado', methods=['GET'])
def get_alumnado_completo():
    try:
        estudiantes = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'curso', 'id_NFC', 'dni', 'fecha_nacimiento']})
        return jsonify({"status": "success", "data": estudiantes})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)})

@app.route('/api/profesorado', methods=['GET'])
def get_profesorado():
    try:
        profesorado = models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.profesor', 'search_read', 
                                        [[]], 
                                        {'fields': ['id', 'nombre', 'apellidos', 'departamento', 'id_NFC']})
        return jsonify({"status": "success", "data": profesorado})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)})

@app.route('/api/vincular_nfc', methods=['POST'])
def vincular_nfc():
    datos = request.get_json()
    try:
        models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.estudiante', 'write', 
                          [[int(datos['id'])], {'id_NFC': datos.get('nfc')}])
        return jsonify({'status': 'success', 'mensaje': 'Vinculado correctamente'})
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

@app.route("/AsistenciaEstudiante", methods=['POST'])
def Asistencia_estudiante():
    datos = request.get_json()
    try:
        models.execute_kw(DB, uid, PASSWORD, 'acceso_ies.asistencia_estudiante', 'create', datos)
    except Exception as e:
        return jsonify({'status': 'error', 'mensaje': str(e)})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)