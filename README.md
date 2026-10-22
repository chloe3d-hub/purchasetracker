**Pedidos Yi Shu Studio**

App web para registrar los pedidos de Yi Shu Studio y guardarlos en una hoja de Google. Funciona en el celular y en el computador.

**Archivos**

- `index.html`: la app. No necesita instalarse, se abre en el navegador.
- `Code.gs`: el código de Google Apps Script que recibe los pedidos y los escribe en la hoja.

**Cómo abrirla**

Con GitHub Pages activado, la app queda en https://chloe3d-hub.github.io/purchasetracker/

**Cómo conectarla a la hoja (una sola vez)**

1. Entra a script.google.com con la cuenta dueña de la hoja y crea un proyecto nuevo. Pega el contenido de `Code.gs`.
2. Cambia `CAMBIA-ESTA-CLAVE` por una clave propia. Si el script no está dentro de la hoja, pega también el ID de la hoja en `ID_HOJA`.
3. Ejecuta la función `configurarHoja` y acepta los permisos. Esto crea la pestaña "Pedidos".
4. Implementar > Nueva implementación > Aplicación web. Ejecutar como "Yo", acceso "Cualquier persona". Copia la URL que termina en `/exec`.
5. Abre la app, toca el ícono de ajustes y pega la URL y la clave. Toca "Probar conexión" y luego "Guardar".

**Privacidad**

Este repositorio no contiene la URL del script, la clave ni el enlace de la hoja. Esos datos se escriben en los ajustes de la app y quedan guardados solo en el navegador de cada dispositivo. No los agregues a los archivos de este repositorio.

Si cambias `Code.gs` después de implementarlo, ve a Implementar > Administrar implementaciones > editar > Nueva versión. La URL no cambia.
