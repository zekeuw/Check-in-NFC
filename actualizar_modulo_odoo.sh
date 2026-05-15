#!/bin/bash

# Script para actualizar el módulo acceso_ies en Odoo
# Ejecutar después de modificar los modelos

echo "🔄 Actualizando módulo acceso_ies en Odoo..."

cd odoo

# Verificar que los contenedores están corriendo
if ! docker compose ps | grep -q "Up"; then
    echo "⚠️  Los contenedores no están corriendo. Iniciando..."
    docker compose up -d
    echo "⏳ Esperando 10 segundos a que Odoo inicie..."
    sleep 10
fi

# Reiniciar Odoo y actualizar el módulo
echo "📦 Actualizando módulo..."
docker compose restart odoo-dev

# Esperar a que Odoo esté listo
echo "⏳ Esperando a que Odoo esté disponible..."
sleep 15

# Actualizar el módulo mediante la interfaz de Odoo
echo ""
echo "✅ Contenedores reiniciados correctamente"
echo ""
echo "⚠️  ACCIÓN MANUAL REQUERIDA:"
echo "   1. Abre http://localhost:8072"
echo "   2. Ve a Ajustes → Activar modo desarrollador"
echo "   3. Ve a Aplicaciones → Actualizar lista de aplicaciones"
echo "   4. Busca 'Acceso IES' y haz clic en 'Actualizar'"
echo ""
echo "   O ejecuta este comando para actualización automática:"
echo "   docker exec odoo-server-ies odoo -d Servidor_proyecto -u acceso_ies --stop-after-init"
echo ""
echo "📋 Nuevos campos disponibles tras la actualización:"
echo "   - Campo 'en_recreo' en el modelo Estudiante"
echo "   - Estados 'sale recreo' y 'vuelve recreo' en AsistenciaEstudiante"

