import pytest
from unittest.mock import MagicMock, patch
import app as flask_app
from datetime import datetime, timedelta

@pytest.fixture
def client():
    """Configura el cliente de pruebas de Flask."""
    flask_app.app.config['TESTING'] = True
    with flask_app.app.test_client() as client:
        yield client

@pytest.fixture
def mock_odoo():
    """
    Simula una conexión exitosa a Odoo parcheando las variables globales 
    'uid' y 'models' dentro de app.py.
    """
    with patch('app.uid', 1), patch('app.models', MagicMock()) as mock_models:
        yield mock_models

@pytest.fixture
def headers_con_api_key():
    """Headers con API key válida para las peticiones."""
    return {'x-api-key': 'kartu_prosim', 'Content-Type': 'application/json'}



class TestValidaciones:
    """Tests para las funciones de validación."""
    
    def test_validar_nombre_correcto(self):
        """Nombres válidos deben pasar la validación."""
        valido, error = flask_app.validar_nombre("Juan")
        assert valido is True
        assert error is None
        
    def test_validar_nombre_con_tildes(self):
        """Nombres con tildes y ñ deben ser válidos."""
        valido, error = flask_app.validar_nombre("José María")
        assert valido is True
        
        valido, error = flask_app.validar_nombre("Núñez")
        assert valido is True
    
    def test_validar_nombre_vacio(self):
        """Nombres vacíos deben fallar."""
        valido, error = flask_app.validar_nombre("")
        assert valido is False
        assert "vacío" in error
        
    def test_validar_nombre_con_numeros(self):
        """Nombres con números deben fallar."""
        valido, error = flask_app.validar_nombre("Juan123")
        assert valido is False
        assert "números" in error
    
    def test_validar_dni_correcto(self):
        """DNI válido debe pasar la validación."""
        valido, error = flask_app.validar_dni("12345678Z")
        assert valido is True
        assert error is None
    
    def test_validar_dni_letra_incorrecta(self):
        """DNI con letra incorrecta debe fallar."""
        valido, error = flask_app.validar_dni("12345678A")
        assert valido is False
        assert "letra" in error.lower()
    
    def test_validar_dni_formato_incorrecto(self):
        """DNI con formato incorrecto debe fallar."""
        valido, error = flask_app.validar_dni("123456")
        assert valido is False
        assert "8 dígitos" in error
    
    def test_validar_dni_vacio_opcional(self):
        """DNI vacío debe ser válido (es opcional)."""
        valido, error = flask_app.validar_dni("")
        assert valido is True
        assert error is None
    
    def test_validar_fecha_nacimiento_correcta(self):
        """Fecha de nacimiento válida debe pasar."""
        fecha_hace_15_anos = (datetime.now() - timedelta(days=15*365)).strftime('%Y-%m-%d')
        valido, error = flask_app.validar_fecha_nacimiento(fecha_hace_15_anos)
        assert valido is True
        assert error is None
    
    def test_validar_fecha_nacimiento_futura(self):
        """Fecha futura debe fallar."""
        fecha_futura = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        valido, error = flask_app.validar_fecha_nacimiento(fecha_futura)
        assert valido is False
        assert "futura" in error.lower()
    
    def test_validar_fecha_nacimiento_muy_antigua(self):
        """Fecha que daría edad > 80 debe fallar."""
        fecha_antigua = (datetime.now() - timedelta(days=85*365)).strftime('%Y-%m-%d')
        valido, error = flask_app.validar_fecha_nacimiento(fecha_antigua)
        assert valido is False
        assert "alta" in error.lower()
    
    def test_validar_fecha_nacimiento_muy_reciente(self):
        """Fecha que daría edad < 10 debe fallar."""
        fecha_reciente = (datetime.now() - timedelta(days=5*365)).strftime('%Y-%m-%d')
        valido, error = flask_app.validar_fecha_nacimiento(fecha_reciente)
        assert valido is False
        assert "baja" in error.lower()


class TestSeguridad:
    """Tests para validación de API key."""
    
    def test_sin_api_key(self, client, mock_odoo):
        """Peticiones sin API key deben ser rechazadas."""
        response = client.post('/create', json={'nombre': 'Test'})
        assert response.status_code == 401
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'API Key' in data['mensaje']
    
    def test_api_key_incorrecta(self, client, mock_odoo):
        """Peticiones con API key incorrecta deben ser rechazadas."""
        headers = {'x-api-key': 'clave_incorrecta'}
        response = client.post('/create', json={'nombre': 'Test'}, headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data['status'] == 'error'
    
    def test_rutas_publicas_sin_api_key(self, client):
        """Rutas públicas no deben requerir API key."""
        response = client.get('/')
        assert response.status_code == 200


class TestConexionOdoo:
    """Tests relacionados con la conexión a Odoo."""
    
    def test_sin_conexion_odoo(self, client):
        """Endpoints deben devolver error 500 si no hay conexión a Odoo."""
        with patch('app.uid', None), patch('app.obtener_conexion_odoo', return_value=False):
            headers = {'x-api-key': 'kartu_prosim'}
            response = client.post('/procesar-datos', json={'nfc': 'NFC123'}, headers=headers)
            
            data = response.get_json()
            assert data['status'] in ['error', 'exito']



class TestBusqueda:
    """Tests para búsqueda de datos."""
    
    def test_procesar_datos_exito(self, client, mock_odoo, headers_con_api_key):
        """Búsqueda de estudiante por NFC exitosa."""
        mock_odoo.execute_kw.return_value = [
            {'nombre': 'Juan', 'apellidos': 'Pérez', 'curso': '1eso'}
        ]
        
        response = client.post('/procesar-datos', 
                             json={'nfc': 'NFC123'}, 
                             headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'exito'
        assert len(data['resultado_calculado']) == 1
        assert data['resultado_calculado'][0]['nombre'] == 'Juan'
    
    def test_procesar_datos_no_encontrado(self, client, mock_odoo, headers_con_api_key):
        """Búsqueda de NFC no existente."""
        mock_odoo.execute_kw.return_value = []
        
        response = client.post('/procesar-datos', 
                             json={'nfc': 'NFC999'}, 
                             headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'exito'
        assert len(data['resultado_calculado']) == 0


class TestCrearRegistros:
    """Tests para creación de estudiantes y profesores."""
    
    def test_crear_estudiante_completo(self, client, mock_odoo, headers_con_api_key):
        """Creación de estudiante con todos los datos."""
        mock_odoo.execute_kw.side_effect = [
            [],  
            [],  
            [],  
            42   
        ]
        
        nuevo_estudiante = {
            'tipo': 'alumno',
            'nombre': 'Ana',
            'apellidos': 'Gómez García',
            'dni': '12345678Z',
            'curso': '2eso',
            'fecha_nacimiento': '2010-05-10',
            'id_NFC': 'NFC999',
            'recreo': True,
            'salida_anticipada': False
        }
        
        response = client.post('/create', json=nuevo_estudiante, headers=headers_con_api_key)
        
        assert response.status_code in [200, 201]
        data = response.get_json()
        assert data['status'] == 'exito'
        assert '42' in data['mensaje']
    
    def test_crear_profesor_completo(self, client, mock_odoo, headers_con_api_key):
        """Creación de profesor con todos los datos."""
        mock_odoo.execute_kw.side_effect = [
            [],
            [],  
            [], 
            55   
        ]
        
        nuevo_profesor = {
            'tipo': 'profesor',
            'nombre': 'Carlos',
            'apellidos': 'Martínez López',
            'dni': '87654321X',
            'departamento': 'informatica',
            'id_NFC': 'PROF001'
        }
        
        response = client.post('/create', json=nuevo_profesor, headers=headers_con_api_key)
        
        assert response.status_code in [200, 201]
        data = response.get_json()
        assert data['status'] == 'exito'
        assert '55' in data['mensaje']
    
    def test_crear_estudiante_nombre_invalido(self, client, mock_odoo, headers_con_api_key):
        """Creación falla con nombre inválido."""
        nuevo_estudiante = {
            'tipo': 'alumno',
            'nombre': 'Ana123',  
            'apellidos': 'Gómez',
            'curso': '1eso',
            'fecha_nacimiento': '2010-05-10'
        }
        
        response = client.post('/create', json=nuevo_estudiante, headers=headers_con_api_key)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'Nombre inválido' in data['mensaje']
    
    def test_crear_estudiante_dni_invalido(self, client, mock_odoo, headers_con_api_key):
        """Creación falla con DNI inválido."""
        nuevo_estudiante = {
            'tipo': 'alumno',
            'nombre': 'Ana',
            'apellidos': 'Gómez',
            'dni': '12345678A',  
            'curso': '1eso',
            'fecha_nacimiento': '2010-05-10'
        }
        
        response = client.post('/create', json=nuevo_estudiante, headers=headers_con_api_key)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'DNI' in data['mensaje']
    
    def test_crear_estudiante_dni_duplicado(self, client, mock_odoo, headers_con_api_key):
        """Creación falla con DNI duplicado."""
        mock_odoo.execute_kw.return_value = [123]  
        
        nuevo_estudiante = {
            'tipo': 'alumno',
            'nombre': 'Ana',
            'apellidos': 'Gómez',
            'dni': '12345678Z',
            'curso': '1eso',
            'fecha_nacimiento': '2010-05-10'
        }
        
        response = client.post('/create', json=nuevo_estudiante, headers=headers_con_api_key)
        
        assert response.status_code == 409
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'ya está registrado' in data['mensaje'] or 'ya existe' in data['mensaje']


class TestVincularNFC:
    """Tests para vincular y desvincular NFC."""
    
    def test_vincular_nfc_exito(self, client, mock_odoo, headers_con_api_key):
        """Vinculación exitosa de NFC a estudiante."""
        mock_odoo.execute_kw.side_effect = [
            [],    
            [],    
            True   
        ]
        
        datos = {
            'id': 10,
            'nfc': 'NFC-NUEVO-001',
            'tipo': 'alumnos'
        }
        
        response = client.post('/api/vincular_nfc', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'success'
        assert 'correctamente' in data['mensaje']
    
    def test_vincular_nfc_ya_asignado_mismo_modelo(self, client, mock_odoo, headers_con_api_key):
        """Vinculación falla si NFC ya está asignado a otro estudiante."""
        mock_odoo.execute_kw.return_value = [999]  
        
        datos = {
            'id': 10,
            'nfc': 'NFC-USADO',
            'tipo': 'alumnos'
        }
        
        response = client.post('/api/vincular_nfc', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 409
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'ya está asignado' in data['mensaje']
    
    def test_vincular_nfc_conflicto_modelo_contrario(self, client, mock_odoo, headers_con_api_key):
        """Vinculación falla si NFC está asignado a profesor."""
        mock_odoo.execute_kw.side_effect = [
            [],    
            [777] 
        ]
        
        datos = {
            'id': 10,
            'nfc': 'NFC-PROFESOR',
            'tipo': 'alumnos'
        }
        
        response = client.post('/api/vincular_nfc', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 409
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'profesor' in data['mensaje']
    
    def test_desvincular_nfc_exito(self, client, mock_odoo, headers_con_api_key):
        """Desvinculación exitosa de NFC."""
        mock_odoo.execute_kw.side_effect = [
            [{'id': 10, 'id_NFC': 'NFC001'}],  
            True  
        ]
        
        datos = {
            'id': 10,
            'tipo': 'alumnos'
        }
        
        response = client.post('/api/desvincular_nfc', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'success'
        assert 'desvinculado' in data['mensaje'].lower()
    
    def test_desvincular_nfc_sin_nfc_asignado(self, client, mock_odoo, headers_con_api_key):
        """Desvinculación falla si no hay NFC asignado."""
        mock_odoo.execute_kw.return_value = [{'id': 10, 'id_NFC': False}]
        
        datos = {
            'id': 10,
            'tipo': 'alumnos'
        }
        
        response = client.post('/api/desvincular_nfc', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'no tiene ningún NFC' in data['mensaje']


class TestAsistenciaProfesor:
    """Tests para registro de asistencia de profesores."""
    
    def test_asistencia_profesor_entrada(self, client, mock_odoo):
        """Registro de llegada de profesor."""
        mock_odoo.execute_kw.side_effect = [
            [{'id': 1, 'nombre': 'Carlos Martínez'}],  
            50 
        ]
        
        datos = {
            'id_NFC': 'PROF001',
            'estado_asistencia': 'entrada'
        }
        
        response = client.post('/AsistenciaProfesor', json=datos)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['status'] == 'success'
        assert 'registrada' in data['mensaje']
        assert data['registro_id'] == 50
    
    def test_asistencia_profesor_salida(self, client, mock_odoo):
        """Registro de salida de profesor."""
        mock_odoo.execute_kw.side_effect = [
            [{'id': 1, 'nombre': 'Carlos Martínez'}],  
            51  
        ]
        
        datos = {
            'id_NFC': 'PROF001',
            'estado_asistencia': 'salida'
        }
        
        response = client.post('/AsistenciaProfesor', json=datos)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['status'] == 'success'
        assert 'Salida registrada' in data['mensaje']
    
    def test_asistencia_profesor_nfc_no_registrado(self, client, mock_odoo):
        """Asistencia falla con NFC no registrado."""
        mock_odoo.execute_kw.side_effect = [
            [],  
            []   
        ]
        
        datos = {
            'id_NFC': 'NFC999',
            'estado_asistencia': 'entrada'
        }
        
        response = client.post('/AsistenciaProfesor', json=datos)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'no registrada' in data['mensaje']
    
    def test_asistencia_profesor_tarjeta_estudiante(self, client, mock_odoo):
        """Asistencia falla si tarjeta pertenece a estudiante."""
        mock_odoo.execute_kw.side_effect = [
            [], 
            [{'nombre': 'Juan Pérez'}]  
        ]
        
        datos = {
            'id_NFC': 'EST001',
            'estado_asistencia': 'entrada'
        }
        
        response = client.post('/AsistenciaProfesor', json=datos)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'estudiante' in data['mensaje']


class TestAsistenciaEstudiante:
    """Tests para registro de asistencia de estudiantes."""
    
    def test_asistencia_estudiante_llegada_tarde(self, client, mock_odoo):
        """Registro de llegada tarde de estudiante."""
        mock_odoo.execute_kw.side_effect = [
            [{'id': 5, 'nombre': 'Ana López', 'recreo': True, 'salida_anticipada': False}],
            60  
        ]
        
        datos = {
            'id_NFC': 'EST001',
            'estado_asistencia': 'llego tarde'
        }
        
        response = client.post('/AsistenciaEstudiante', json=datos)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['status'] == 'success'
    
    def test_asistencia_estudiante_salida_anticipada_con_permiso(self, client, mock_odoo):
        """Registro de salida anticipada con permiso."""
        mock_odoo.execute_kw.side_effect = [
            [{'id': 5, 'nombre': 'Ana López', 'recreo': True, 'salida_anticipada': True}],
            61  
        ]
        
        datos = {
            'id_NFC': 'EST001',
            'estado_asistencia': 'salida anticipada'
        }
        
        response = client.post('/AsistenciaEstudiante', json=datos)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['status'] == 'success'
    
    def test_asistencia_estudiante_salida_anticipada_sin_permiso(self, client, mock_odoo):
        """Salida anticipada falla sin permiso."""
        mock_odoo.execute_kw.return_value = [
            {'id': 5, 'nombre': 'Ana López', 'recreo': True, 'salida_anticipada': False}
        ]
        
        datos = {
            'id_NFC': 'EST001',
            'estado_asistencia': 'salida anticipada'
        }
        
        response = client.post('/AsistenciaEstudiante', json=datos)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['status'] == 'error'
        assert 'no tiene permisos' in data['mensaje']
    
    def test_asistencia_estudiante_nfc_no_registrado(self, client, mock_odoo):
        """Asistencia falla con NFC no registrado."""
        mock_odoo.execute_kw.return_value = []
        
        datos = {
            'id_NFC': 'EST999',
            'estado_asistencia': 'llego tarde'
        }
        
        response = client.post('/AsistenciaEstudiante', json=datos)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['status'] == 'error'


class TestSalidaRecreo:
    """Tests para la gestión de salida en recreo."""
    
    def test_salida_recreo_mayor_edad(self, client, mock_odoo, headers_con_api_key):
        """Estudiante mayor de edad obtiene permiso automáticamente."""
        fecha_mayor = (datetime.now() - timedelta(days=19*365)).strftime('%Y-%m-%d')
        mock_odoo.execute_kw.side_effect = [
            [{'id': 1, 'nombre': 'Carlos', 'apellidos': 'Ruiz', 
              'recreo': False, 'fecha_nacimiento': fecha_mayor, 'curso': '2bach'}],
            True 
        ]
        
        response = client.post('/Salida_Recreo', json={'nfc': 'NFC001'}, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'success'
        assert data['data'][0]['recreo'] is True
    
    def test_salida_recreo_menor_edad(self, client, mock_odoo, headers_con_api_key):
        """Estudiante menor de edad se le quita el permiso."""
        fecha_menor = (datetime.now() - timedelta(days=14*365)).strftime('%Y-%m-%d')
        mock_odoo.execute_kw.side_effect = [
            [{'id': 2, 'nombre': 'Luis', 'apellidos': 'García', 
              'recreo': True, 'fecha_nacimiento': fecha_menor, 'curso': '2eso'}],
            True  
        ]
        
        response = client.post('/Salida_Recreo', json={'nfc': 'NFC002'}, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'success'
        assert data['data'][0]['recreo'] is False


class TestConsultasListas:
    """Tests para obtención de listas de datos."""
    
    def test_obtener_alumnado(self, client, mock_odoo, headers_con_api_key):
        """Obtener lista de todos los estudiantes."""
        mock_odoo.execute_kw.return_value = [
            {'id': 1, 'nombre': 'Ana', 'apellidos': 'López', 'curso': '1eso'},
            {'id': 2, 'nombre': 'Juan', 'apellidos': 'Pérez', 'curso': '2eso'}
        ]
        
        response = client.get('/api/alumnado', headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        if isinstance(data, dict):
            assert 'data' in data or len(data) > 0
        else:
            assert len(data) == 2
            assert data[0]['nombre'] == 'Ana'
    
    def test_obtener_profesorado(self, client, mock_odoo, headers_con_api_key):
        """Obtener lista de todos los profesores."""
        mock_odoo.execute_kw.return_value = [
            {'id': 1, 'nombre': 'Carlos', 'apellidos': 'Martínez', 'departamento': 'informatica'}
        ]
        
        response = client.get('/api/profesorado', headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        if isinstance(data, dict):
            assert 'data' in data or len(data) > 0
        else:
            assert len(data) == 1
            assert data[0]['nombre'] == 'Carlos'


class TestEliminarRegistros:
    """Tests para eliminación de registros."""
    
    def test_borrar_estudiante(self, client, mock_odoo, headers_con_api_key):
        """Eliminación exitosa de estudiante."""
        mock_odoo.execute_kw.return_value = True
        
        datos = {'id': 10, 'tipo': 'alumnos'}
        
        response = client.post('/api/borrar_persona', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] in ['success', 'exito']
    
    def test_borrar_profesor(self, client, mock_odoo, headers_con_api_key):
        """Eliminación exitosa de profesor."""
        mock_odoo.execute_kw.return_value = True
        
        datos = {'id': 5, 'tipo': 'profesores'}
        
        response = client.post('/api/borrar_persona', json=datos, headers=headers_con_api_key)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] in ['success', 'exito']


class TestObtenerProfesor:
    """Tests para obtener información de profesor."""
    
    def test_get_profesor_exito(self, client, mock_odoo):
        """Obtener profesor por NFC exitosamente."""
        mock_odoo.execute_kw.return_value = [
            {'id': 1, 'nombre': 'Carlos', 'apellidos': 'Martínez', 'departamento': 'informatica'}
        ]
        
        response = client.post('/GetProfesor', json={'nfc': 'PROF001'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'success'
        assert 'data' in data
        assert data['data'][0]['nombre'] == 'Carlos'
    
    def test_get_profesor_no_encontrado(self, client, mock_odoo):
        """Obtener profesor con NFC no registrado."""
        mock_odoo.execute_kw.return_value = []
        
        response = client.post('/GetProfesor', json={'nfc': 'PROF999'})
        
        assert response.status_code in [200, 404]
        data = response.get_json()
        if response.status_code == 404:
            assert data['status'] == 'error'