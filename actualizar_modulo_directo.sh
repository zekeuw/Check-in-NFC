#!/bin/bash

# Script alternativo para actualizar el módulo de Odoo de forma directa
# Este método actualiza el módulo sin detener el servicio

echo "🔄 Actualizando módulo acceso_ies (método directo)..."

cd /home/admin-server/Desktop/Check-in-NFC-Version-Previa-a-Final/odoo

# Ejecutar actualización dentro del contenedor en ejecución
docker exec odoo-server-ies odoo \
    --database=Servidor_proyecto \
    --db_host=db-dev \
    --db_user=odoo \
    --db_password=odoo_pass_dev \
    --update=acceso_ies \
    --stop-after-init

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Módulo actualizado correctamente"
    echo ""
    echo "🔄 Reiniciando servicio Odoo para aplicar cambios..."
    docker compose restart odoo-dev
    
    echo ""
    echo "⏳ Esperando a que Odoo esté disponible..."
    sleep 10
    
    echo ""
    echo "✅ Sistema actualizado completamente"
    echo ""
    echo "📋 Cambios aplicados:"
    echo "   ✓ Campo 'en_recreo' añadido al modelo Estudiante"
    echo "   ✓ Estados 'sale recreo' y 'vuelve recreo' en AsistenciaEstudiante"
    echo ""
    echo "🌐 Odoo disponible en: http://localhost:8072"
else
    echo ""
    echo "❌ Error actualizando el módulo"
    echo ""
    echo "💡 Intenta el método manual:"
    echo "   1. Abre http://localhost:8072"
    echo "   2. Ve a Ajustes → Activar modo desarrollador"
    echo "   3. Ve a Aplicaciones → Actualizar lista"
    echo "   4. Busca 'Acceso IES' → Actualizar"
    exit 1
fi
