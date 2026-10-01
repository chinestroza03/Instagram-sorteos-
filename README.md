# 🎁 Sorteos de Instagram

App web para hacer sorteos con los comentarios de una publicación de Instagram. **Sin base de datos y sin servidor**: todo corre en el navegador.

## Funciones

- **Extraer participantes** de tres formas:
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

## Estructura

```
index.html              Interfaz
css/styles.css          Estilos
js/parser.js            Extracción de usuarios de texto, CSV y JSON
js/instagram-api.js     Cliente opcional de la Graph API de Instagram
js/draw.js              Azar, selección sin repetición, huella y sonidos
js/pdf.js               Generación del acta en PDF
js/app.js               Lógica de la interfaz y animación del sorteo
js/vendor/              Librerías de terceros
```

## Notas

- Instagram no permite leer comentarios de cualquier publicación sin autenticación; por eso la vía sin token es copiar y pegar. La API sólo funciona con cuentas profesionales y para publicaciones propias.
- Recargar la página borra los datos (no se guarda nada).
