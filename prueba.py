import sys
import requests
from datetime import datetime

def verificar_usuario_nfc():
    print("\n--- MODO ESCANER ACTIVADO ---")
    print("Esperando tarjeta (asegúrate de que esta ventana tenga el foco)...")
    print("Presiona Ctrl+C para volver al menú principal.")

    while True:
        try:
            nfc_id = input("Escanea ahora: ").strip()
            
            if nfc_id:
                print(f"ID detectado: {nfc_id}")
                url = "http://10.102.7.221:5000/procesar-datos"

                try:
                    datos = {"nfc": nfc_id}
                    respuesta = requests.post(url, json=datos)
                    datos_respuesta = respuesta.json()

                    if datos_respuesta.get("resultado_calculado") == []:
                        print(">> El usuario NO existe")
                    else:
                        print(">> El usuario EXISTE")
                
                except requests.exceptions.RequestException as e:
                    print(f"Error de conexión con el servidor: {e}")
                except ValueError:
                    print("Error: La respuesta del servidor no es un JSON válido.")

        except KeyboardInterrupt:
            print("\nDeteniendo escáner y volviendo al menú...")
            return


def Create_Student():
    print("\n" + "="*40)
    print("   REGISTRO DE NUEVO ESTUDIANTE")
    print("="*40)
    print("Por favor, introduce los datos solicitados.\n")

    try:
        nombre = input("Nombre: ").strip()
        while not nombre:
            print("El nombre es obligatorio.")
            nombre = input("Nombre: ").strip()

        apellidos = input("Apellidos: ").strip()
        while not apellidos:
            print("Los apellidos son obligatorios.")
            apellidos = input("Apellidos: ").strip()

        dni = input("DNI: ").strip()
        resp_recreo = input("¿Tiene permiso de recreo? [S/n]: ").strip().lower()
        recreo = False if resp_recreo == 'n' else True

        resp_salida = input("¿Tiene salida anticipada? [s/N]: ").strip().lower()
        salida_anticipada = True if resp_salida == 's' else False

        print("\n--- ESCANEO DE TARJETA ---")
        print("Acerca la tarjeta al lector ahora (o Ctrl+C para cancelar)...")
        
        nfc_id = ""
        while not nfc_id:
            nfc_id = input("Esperando lectura NFC: ").strip()
            if not nfc_id:
                print("Lectura vacía, intenta de nuevo.")

        print(f"ID NFC Capturado: {nfc_id}")

        datos_estudiante = {
            "nombre": nombre,
            "apellidos": apellidos,
            "dni": dni,
            "id_NFC": nfc_id,
            "recreo": recreo,
            "salida_anticipada": salida_anticipada
        }

        print("\nResumen de datos a guardar:")
        print(datos_estudiante)

        confirmar = input("\n¿Guardar en Odoo? [S/n]: ").strip().lower()
        
        if confirmar != 'n':
            url = "http://10.102.7.221:5000/create"
            try:
                resp = requests.post(url, json=datos_estudiante)
                if resp.status_code == 200:
                    print("¡Estudiante creado con éxito!")
                else:
                    print(f"Error al crear: {resp.text}")
            except Exception as e:
                print(f"Error de conexión: {e}")
            
        else:
            print("Operación cancelada. No se guardaron datos.")

    except KeyboardInterrupt:
        print("\nRegistro cancelado por el usuario.")
        return

    input("\nPresiona Enter para volver al menú...")
    

def Salida_Recreo():
    print("\n--- MODO ESCANER ACTIVADO ---")
    print("Esperando tarjeta (asegúrate de que esta ventana tenga el foco)...")
    print("Presiona Ctrl+C para volver al menú principal.")

    while True:
        try:
            nfc_id = input("Escanea ahora: ").strip()
            
            if nfc_id:
                url = "http://10.102.7.221:5000/Salida_Recreo"

                try:
                    datos = {"nfc": nfc_id}
                    respuesta = requests.post(url, json=datos)
                    datos_respuesta = respuesta.json()
                    if datos_respuesta.get("status") == "error":
                        print(f">> {datos_respuesta.get("data")}")
                    else:
                        if datos_respuesta.get("data")[0]["recreo"] == True:
                            print(f">> El estudiante {datos_respuesta.get("data")[0]["nombre"]} PUEDE salir duarnte el recreo")
                        else:
                            print(f">> {datos_respuesta.get("data")[0]["nombre"]} se la mama")
                
                except requests.exceptions.RequestException as e:
                    print(f"Error de conexión con el servidor: {e}")
                except ValueError:
                    print("Error: La respuesta del servidor no es un JSON válido.")

        except KeyboardInterrupt:
            print("\nDeteniendo escáner y volviendo al menú...")
            return

def Asistencia_Estudiante():
    url = "http://10.102.7.221:5000/AsistenciaEstudiante"
    while True:
        asistencia = input("Escriba entrada o salida (1/2): ")

        if asistencia == "1":
            asistencia = "llego tarde"
        elif asistencia == "2":
            asistencia = "salida anticipada"
        else:
            continue

        nfc = input("Escanee la tarjeta: ")

        datos = {"id_NFC": nfc, "estado_asistencia": asistencia}

        try:
            resp = requests.post(url, json=datos)

        except Exception as e:
            print(e)

def Asistencia_Profesor():
    url = "http://10.102.7.221:5000/AsistenciaProfesor"
    while True:
        asistencia = input("Escriba entrada o salida (1/2): ")

        if asistencia == "1":
            asistencia = "llego al centro"
        elif asistencia == "2":
            asistencia = "sale del centro"
        else:
            continue

        nfc = input("Escanee la tarjeta: ")

        datos = {"id_NFC": nfc, "estado_asistencia": asistencia}

        try:
            resp = requests.post(url, json=datos)
            print(resp)
        except Exception as e:
            print(e)


# --- MENÚ PRINCIPAL ---
def mostrar_menu():
    while True:
        print("\n" + "="*30)
        print("      SISTEMA DE CONTROL NFC")
        print("="*30)
        print("1. Verificar Usuario (Escanear NFC)")
        print("2. Crear un nuevo estudiante")
        print("3. Verificar salida al recreo")
        print("4. Registrar asistencia")
        print("5. Registrar asistencia (profesor)")
        print("6. Salir del programa")
        print("-" * 30)

        opcion = input("Selecciona una opción (1-5): ")

        if opcion == '1':
            verificar_usuario_nfc()
        elif opcion == '2':
            Create_Student()
        elif opcion == '3':
            Salida_Recreo()
        elif opcion == '4':
            Asistencia_Estudiante()
        elif opcion == '6':
            print("Saliendo del sistema. ¡Hasta luego!")
            sys.exit()
        elif opcion == '5':
            Asistencia_Profesor()
        else:
            print("Opción no válida, por favor intenta de nuevo.")

if __name__ == "__main__":
    try:
        mostrar_menu()
    except KeyboardInterrupt:
        print("\n\nCierre forzado detectado. Adiós.")