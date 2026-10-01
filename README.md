# 🎁 Sorteos de Instagram

App web para hacer sorteos con los comentarios de una publicación de Instagram. **Sin base de datos y sin servidor**: todo corre en el navegador.

## Funciones

- **Extraer participantes** de cuatro formas:
  - **Extractor automático (recomendado)**: un botón que guardas en la barra de marcadores. Abres la publicación en instagram.com, lo pulsas y saca *todos* los comentarios (y respuestas) en segundos usando tu propia sesión. Luego pegas el resultado en la app.
  - **Pegar comentarios** copiados desde instagram.com: detecta el usuario de cada comentario e ignora textos como “Responder”, “3 sem” o “12 Me gusta”. También acepta una lista de usuarios o extraer todas las @menciones.
  - **Importar archivo** `.csv`, `.json` o `.txt` (exportaciones de herramientas de comentarios o respuestas de la API).
  - **API de Instagram** (opcional): con un token de una cuenta profesional, lista tus publicaciones y descarga todos los comentarios (con respuestas).
- **Listado de participantes** con buscador, conteo de comentarios y etiquetas, y casilla para excluir a alguien a mano.
- **Reglas**: excluir cuentas (p. ej. la del organizador), mínimo de amigos etiquetados, palabra o #hashtag obligatorio, y 1 oportunidad por persona o por comentario.
- **Sorteo con suspenso**: cuenta regresiva, ruleta de nombres que se va frenando, sonido y confeti. Revela los ganadores uno a uno.
- **Número de ganadores y suplentes** configurable. **Los ganadores nunca se repiten.**
- Azar con `crypto.getRandomValues` (generador criptográfico del navegador).
- **Acta en PDF** con datos del sorteo, reglas, ganadores, suplentes, huella SHA-256 de la lista y anexo con todos los participantes.
- Exportar participantes a CSV y copiar los ganadores para publicarlos.

## Uso

Abre `index.html` en el navegador (doble clic). No necesita instalación ni internet: las librerías (jsPDF, AutoTable, canvas-confetti) están en `js/vendor/`.

Para publicarla gratis: activa **GitHub Pages** en el repositorio (Settings → Pages → rama principal, carpeta raíz).

Prueba rápida: pega el contenido de `ejemplos/comentarios-ejemplo.txt` o pulsa “Cargar ejemplo”.

## Extractor automático (bookmarklet)

1. En la pestaña **⚡ Extractor automático**, arrastra el botón “🎁 Extraer comentarios” a la barra de marcadores (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> para mostrarla). Si no puedes arrastrarlo, usa “Copiar código” y crea un marcador con ese código como URL.
2. Abre la publicación en instagram.com (en el computador, con sesión iniciada) y pulsa el marcador.
3. Pulsa **Copiar resultado** en el recuadro que aparece, vuelve a la app y pulsa **Pegar del portapapeles**. También puedes descargar el `.json` e importarlo.

La URL de la publicación y la cuenta dueña se rellenan solas, y esa cuenta se excluye del sorteo automáticamente.

Usa la API interna de la web de Instagram (no oficial), con pausas entre consultas. Si Instagram la cambia, sólo hay que ajustar `js/bookmarklet.js`. Úsalo con tus propias publicaciones o con permiso de la cuenta.

## Estructura

```
index.html              Interfaz
css/styles.css          Estilos
js/parser.js            Extracción de usuarios de texto, CSV y JSON
js/bookmarklet.js       Extractor de comentarios que corre en instagram.com
js/instagram-api.js     Cliente opcional de la Graph API de Instagram
js/draw.js              Azar, selección sin repetición, huella y sonidos
js/pdf.js               Generación del acta en PDF
js/app.js               Lógica de la interfaz y animación del sorteo
js/vendor/              Librerías de terceros
```

## Notas

- Instagram no permite leer comentarios de cualquier publicación sin autenticación; por eso el extractor corre dentro de tu sesión de instagram.com. La API sólo funciona con cuentas profesionales y para publicaciones propias.
- Recargar la página borra los datos (no se guarda nada).
