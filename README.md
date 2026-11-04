**Yi Shu Manager**

App web para llevar los pedidos de Yi Shu Studio: registrar pedidos, ver las entregas en un calendario, organizar la cola de impresión, calcular costos y ganancia, y ver cómo va el negocio. Los datos viven en una hoja de Google. Funciona en el celular y en el computador, y se puede instalar en la pantalla de inicio como una app.

**Qué hace**

- Pedidos: varios productos por pedido, estados, pagos, edición de fechas, total de todos los pedidos y filtro por mes.
- Calendario: vista mensual de las entregas dentro de la app y, si se activa, eventos en Google Calendar ("Entregas Yi Shu") con aviso en el celular el día anterior a las 9:00 am.
- Producción: cola de lo que hay que imprimir, ordenada por urgencia, con impresora, horas y gramos por pedido.
- Números: ventas por mes, por canal, por categoría y mejores clientes; gastos del negocio por categoría.
- Costos: costo por gramo de filamento, precio de la luz y costo por hora de cada impresora (con una calculadora: luz + desgaste + mantenimiento). La ganancia de cada pedido sale de esos datos.
- Fichas de costo: lo que lleva una unidad de cada producto (horas, gramos, impresora y componentes). Al crear un pedido, o en Producción, eliges la ficha y los costos se llenan solos. Si un producto no tiene ficha, la app ofrece guardarla con los números que anotaste. La lista de productos sale del catálogo web.
- Componentes: luces, conectores, switches... con el precio del paquete y cuántas unidades trae; la app calcula lo que cuesta una.
- Automatizaciones (se activan desde Ajustes): resumen diario por correo, eventos en Google Calendar y respaldo semanal de la hoja en Drive (se guardan los últimos 8).
- Sin internet: los pedidos y gastos nuevos quedan guardados en el dispositivo y se envían cuando vuelve la conexión.

**Archivos**

- `index.html`: la app ya armada, un solo archivo. Es lo que publica GitHub Pages.
- `Code.gs`: el código de Google Apps Script que recibe los datos y los escribe en la hoja.
- `manifest.webmanifest`, `sw.js` e `icons/`: lo que permite instalarla en el celular y abrir la parte visual sin internet.
- `src/` y `build.js`: el código fuente de la app. Para volver a armar `index.html` después de cambiar algo en `src/`, ejecuta `node build.js`.

**Cómo abrirla**

Con GitHub Pages activado, la app queda en https://chloe3d-hub.github.io/purchasetracker/

**Cómo conectarla a la hoja (una sola vez)**

1. Entra a script.google.com con la cuenta dueña de la hoja y crea un proyecto nuevo. Pega el contenido de `Code.gs`.
2. Cambia `CAMBIA-ESTA-CLAVE` por una clave propia y pega el ID de la hoja en `ID_HOJA`.
3. Ejecuta la función `autorizarPermisos` y acepta los permisos (hoja, Calendar, correo y Drive). Si Google muestra "no ha verificado esta aplicación", entra por Avanzado > Ir a tu proyecto: es tu propio script.
4. En Configuración del proyecto deja la zona horaria en Bogotá.
5. Implementar > Nueva implementación > Aplicación web. Ejecutar como "Yo", acceso "Cualquier persona". Copia la URL que termina en `/exec`.
6. Abre la app, toca el ícono de ajustes y pega la URL y la clave. Toca "Probar conexión" y luego "Guardar". Debe decir versión 4.

**Abrirla en el celular**

En Ajustes hay un enlace y un código QR que llevan la conexión al celular sin tener que copiar nada. Después se instala desde el navegador ("Agregar a pantalla de inicio" o el botón de instalar). El enlace y el QR incluyen la clave, así que se tratan como una contraseña.

**Actualizar el script**

Si cambias `Code.gs` después de implementarlo, ve a Implementar > Administrar implementaciones > lápiz > Nueva versión. La URL no cambia y los pedidos no se tocan. Con la versión 4 se crea sola una pestaña nueva llamada "Fichas".

**Privacidad**

Este repositorio no contiene la URL del script, la clave ni el enlace de la hoja. Esos datos se escriben en los ajustes de la app y quedan guardados solo en el navegador de cada dispositivo. No los agregues a los archivos de este repositorio.
