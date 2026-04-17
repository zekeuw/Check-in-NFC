import pytest
from unittest.mock import MagicMock, patch
import app as flask_app

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

def test_procesar_datos_exito(client, mock_odoo):
    """Prueba la búsqueda de un estudiante por NFC de forma exitosa."""
    mock_odoo.execute_kw.return_value = [{'nombre': 'Juan', 'apellidos': 'Perez', 'curso': '1A'}]
    
    response = client.post('/procesar-datos', json={'nfc': 'NFC123'})
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'exito'
    assert len(data['resultado_calculado']) == 1
    assert data['resultado_calculado'][0]['nombre'] == 'Juan'
    mock_odoo.execute_kw.assert_called_once()

def test_sin_conexion_odoo(client):
    """Prueba que los endpoints devuelven error 500 si no hay conexión a Odoo (uid = None)."""
    with patch('app.uid', None), patch('app.xmlrpc.client.ServerProxy') as mock_proxy:
        mock_proxy.side_effect = Exception("Servidor Odoo inalcanzable")
        
        response = client.post('/procesar-datos', json={'nfc': 'NFC123'})
        
        assert response.status_code == 500
        assert response.get_json()['mensaje'] == 'Sin conexión Odoo'
def test_crear_registro_alumno(client, mock_odoo):
    """Prueba la creación de un nuevo alumno."""
    mock_odoo.execute_kw.return_value = 42
    
    nuevo_alumno = {
        'tipo': 'alumno',
        'nombre': 'Ana',
        'apellidos': 'Gómez',
        'dni': '12345678A',
        'curso': '2B',
        'fecha_nacimiento': '2010-05-10',
        'id_NFC': 'NFC999'
    }
    
    response = client.post('/create', json=nuevo_alumno)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'exito'
    assert '42' in data['mensaje']

def test_salida_recreo_mayor_edad(client, mock_odoo):
    """Prueba la lógica de edad para conceder el permiso de salida al recreo."""
    mock_odoo.execute_kw.return_value = [{
        'id': 1,
        'nombre': 'Carlos',
        'apellidos': 'Ruiz',
        'recreo': False,
        'fecha_nacimiento': '2000-01-01',
        'curso': '2 Bach'
    }]
    
    response = client.post('/Salida_Recreo', json={'nfc': 'NFC001'})
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['data'][0]['recreo'] is True
    assert mock_odoo.execute_kw.call_count == 2

def test_salida_recreo_menor_edad(client, mock_odoo):
    """Prueba la lógica de edad para un alumno menor de edad (no se concede permiso)."""
    mock_odoo.execute_kw.return_value = [{
        'id': 2,
        'nombre': 'Luis',
        'apellidos': 'García',
        'recreo': True,
        'fecha_nacimiento': '2020-01-01',
        'curso': '1 ESO'
    }]
    
    response = client.post('/Salida_Recreo', json={'nfc': 'NFC002'})
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['data'][0]['recreo'] is False

def test_vincular_nfc_exito(client, mock_odoo):
    """Prueba la vinculación de un NFC cuando la tarjeta está libre."""
    mock_odoo.execute_kw.side_effect = [[], [], True]
    
    datos = {
        'id': 10,
        'nfc': 'NFC-NUEVO',
        'tipo': 'alumnos'
    }
    
    response = client.post('/api/vincular_nfc', json=datos)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['mensaje'] == 'Vinculado correctamente'

def test_vincular_nfc_conflicto_modelo_contrario(client, mock_odoo):
    """Prueba que no deja vincular un NFC de alumno si ya lo tiene un profesor."""
    mock_odoo.execute_kw.side_effect = [[], [15]]
    
    datos = {
        'id': 10,
        'nfc': 'NFC-USADO',
        'tipo': 'alumnos'
    }
    
    response = client.post('/api/vincular_nfc', json=datos)
    
    assert response.status_code == 409
    data = response.get_json()
    assert data['status'] == 'error'
    assert 'ya está asignado a un profesor' in data['mensaje']

def test_asistencia_estudiante_sin_permiso(client, mock_odoo):
    """Prueba que un estudiante sin permiso no pueda registrar salida anticipada."""
    mock_odoo.execute_kw.return_value = [{'id': 1, 'nombre': 'Laura', 'salida_anticipada': False}]
    
    datos = {
        'id_NFC': 'NFC003',
        'estado_asistencia': 'salida anticipada'
    }
    
    response = client.post('/AsistenciaEstudiante', json=datos)
    
    assert response.status_code == 404
    data = response.get_json()
    assert data['status'] == 'error'
    assert 'no tiene permisos para salir' in data['mensaje']