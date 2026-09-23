# Entrega del prototipo SmartHerd

Fecha: 16 de septiembre de 2026.

## Fuente y alcance

Se consultó el archivo original `/Users/danielgomez/Downloads/Hato-Ganaderia/hato-prototipo.jsx` y el documento `/Users/danielgomez/Downloads/Expo2026/Documentos/SmartHerd ExpoTecnica2026.docx`. Ambos se conservaron sin cambios.

El archivo de Hato aportó la referencia de fichas individuales, aretes, propósito productivo, historial médico y reproductivo. El informe agregó la arquitectura ESP32/LoRa, seguimiento GPS, cerca poligonal, temperatura del collar y comparación de actividad con el historial del propio animal. El diseño conserva verdes, tonos naturales e identificación por arete, con un panel nuevo adaptable a celular.

## Estado verificado

- Compilación de producción correcta.
- Diez pruebas automáticas aprobadas: validación de paquetes, geocerca, línea base, datos obsoletos, función de recepción y base de datos.
- Migración ejecutada en PostgreSQL embebido; verificados roles, RLS, aislamiento entre dos fincas, integridad del vínculo y protección de las mediciones.
- Receptor revisado con el comprobador de Deno. Las pruebas HTTP del manejador usan un cliente de base de datos simulado; no un servicio Supabase remoto.
- Recorrido automatizado de navegador: alta de animal, registro de peso, persistencia después de recargar, búsqueda, asociación de collar, simulación, modificación de finca, descarga CSV y vista de 390 px sin desbordamiento horizontal.
- Capturas de escritorio y celular inspeccionadas visualmente. Sin errores JavaScript en el recorrido final.

## Pendiente antes de uso real

Crear/configurar un proyecto Supabase dedicado, aplicar la migración, crear una cuenta, publicar la función, registrar la credencial de estación y publicar la interfaz. Realizar una prueba completa con datos de ese proyecto y después con la estación y el collar físicos. Calibrar umbrales, definir el índice de actividad y validar seguridad/trazabilidad del enlace LoRa.

No se publicaron recursos remotos, no se usaron credenciales de EcoPoints y no se modificó su base de datos. El prototipo no confirma enfermedades, celo, preñez ni robos automáticamente. Los límites funcionales están descritos en README.md.

## Actualización de apariencia

Se implementaron Tierra cálida y Cacao y terracota con selector persistente, tipografía Lora, botones de esquinas recortadas y colores compartidos mediante variables. Se revisaron visualmente escritorio, celular y formularios en ambos temas. `node tests/themes.mjs` comprueba selección, persistencia, navegación, ausencia de desbordamiento y conservación de los datos de demostración. El recorrido funcional de navegador también pasó. Se desactivaron las animaciones de zoom del mapa para evitar errores al desmontarlo durante cambios rápidos de pantalla.
