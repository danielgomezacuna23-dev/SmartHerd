# Revisión de la interfaz de SmartHerd

18 de septiembre de 2026

El resumen debe ayudar a encontrar rápidamente cuántos animales hay, qué collares reportan y qué requiere atención. La revisión elimina el encabezado decorativo y da prioridad a los indicadores y a las acciones. Se conservan las paletas Tierra cálida y Cacao y terracota, el logo y la montaña del menú lateral.

## Cambios necesarios y aplicados

| Problema encontrado | Cambio aplicado | Resultado esperado |
| --- | --- | --- |
| Tres líneas de presentación dominaban la primera pantalla | Eliminación de «Cada animal, una historia», «Tu ganado, de un vistazo» y su descripción | Los indicadores aparecen inmediatamente después de las acciones |
| Tarjetas informativas con números pequeños y sin interacción | Números de mayor tamaño, etiquetas breves y tarjetas completas pulsables | Acceso directo a ganado, collares, alertas e historial |
| Varias frases repetían lo que ya indicaban los títulos | Retirada de subtítulos promocionales y pie de página reducido | Menos lectura para realizar una tarea |
| Las acciones secundarias parecían texto suelto | Botones con contorno, icono y etiqueta; acción principal rellena | Distinguir qué se puede pulsar y qué es información |
| Esquinas recortadas y formas diferentes competían entre sí | Rectángulos con esquinas suaves y tamaños consistentes | Lenguaje visual uniforme y áreas de interacción completas |
| Indicadores, mapa y alertas tenían poca separación jerárquica | Indicadores al inicio, agrupación de mapa y alertas, fichas de animales después | Orden de lectura orientado a revisar y actuar |
| Las alertas del resumen mostraban todo el texto técnico | Resumen breve; botón para abrir todas las alertas; detalle completo conservado allí y en cada ficha | Menos saturación sin perder información |
| La marca de verificación no explicaba su acción | Botón «Revisada», con nombre accesible «Marcar revisada» | Acción más comprensible y fácil de tocar |
| El contador de eventos no permitía consultar el historial general | Lista de eventos que abre la ficha del animal correspondiente | El indicador tiene una acción útil y verificable |
| Modo de demostración indicado mediante una franja larga | Etiqueta compacta «Demostración · datos ficticios» | Conservación del contexto esencial con menos altura |
| Controles pequeños y títulos que se quebraban innecesariamente | Acciones principales y secundarias con altura mínima de 44 px; distribución adaptable | Mayor comodidad con mouse y pantalla táctil |
| Los formularios permitían perder el foco detrás del cuadro | Foco inicial, recorrido con Tab dentro del diálogo, cierre con Escape y retorno al botón de origen | Uso predecible con teclado |
| Riesgo de saturación en celular | Dos columnas de indicadores, botones apilados cuando hace falta y navegación inferior | Uso sin desplazamiento horizontal en los tamaños comprobados |

## Criterios consultados

- [Nielsen Norman Group — 5 Principles of Visual Design in UX](https://www.nngroup.com/articles/principles-visual-design/): tamaño relativo, jerarquía y proximidad para priorizar información. Aplicado a los números de las tarjetas y la agrupación de acciones.
- [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): tamaño y separación de las áreas interactivas. WCAG 2.2 AA plantea un mínimo de 24 × 24 px con excepciones; esta interfaz utiliza 44 px de altura para las acciones principales y secundarias como objetivo de comodidad.
- [W3C — Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): manejo del foco, Tab y Escape. Aplicado a los formularios y al historial.

Estas referencias guían las decisiones; esta revisión no constituye una certificación integral de accesibilidad ni un estudio con usuarios de fincas.

## Verificación

Las pruebas de interfaz comprueban los cuatro accesos desde indicadores, mapa, historial, navegación por teclado en formularios, regreso del foco, conservación de datos y ausencia de desbordamiento horizontal a 320, 390, 768, 1100 y 1440 px en ambos temas. El recorrido funcional existente comprueba altas, eventos, búsqueda, collares, simulación, exportación y persistencia.

Las capturas se guardan en `test-results/usability/` para revisión local. La paleta permanece definida en `src/theme.css`; los ajustes de disposición, tamaños y formas están en `src/layout.css`.

## Siguiente validación con personas

Observar a una persona usuaria de finca registrar un animal, encontrar un collar sin señal y revisar una alerta. Confirmar si comprende los nombres y localiza las acciones sin ayuda. Esto permitirá ajustar el diseño con evidencia de uso real.
