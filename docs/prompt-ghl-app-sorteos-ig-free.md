# Prompt para la IA de GoHighLevel: "APP Sorteos IG - Free"

Copia todo lo que está dentro del bloque y pégalo en el constructor de IA de GHL.

```text
Desarrolla una aplicación web completa, en español, llamada "APP Sorteos IG - Free".
Sirve para que cualquier persona haga sorteos transparentes con los comentarios de una
publicación de Instagram. Requiere registro, guarda los sorteos en base de datos y
funciona con un sistema de créditos: 3 sorteos gratis al registrarse y luego paquetes
de 10 sorteos por 10 USD.

==================================================
1. MARCA Y DISEÑO
==================================================
- Nombre: "APP Sorteos IG - Free". Eslogan: "Sorteos de Instagram transparentes, en minutos".
- Estilo moderno y limpio, mobile-first, 100 % responsive (16 px de margen lateral en móvil).
- Colores (variables CSS): primario #6C3CE9 (violeta), secundario #E1306C (rosa Instagram),
  acento #F77737 (naranja), éxito #16A34A, error #DC2626, fondo #F7F7FB, superficie #FFFFFF,
  texto #1A1A2E, texto secundario #6B6B80. Botones principales con degradado
  45° de #F77737 a #E1306C a #6C3CE9. Bordes redondeados de 14 px, sombras suaves.
- Fuente: Inter (o system-ui). Iconos simples.
- Modo oscuro automático opcional.

==================================================
2. PÁGINAS Y RUTAS
==================================================
Públicas:
- "/"            Landing: hero, cómo funciona (3 pasos), funciones, precios
                 (Gratis: 3 sorteos · Paquete: 10 sorteos por 10 USD), preguntas
                 frecuentes, botón "Crear cuenta gratis".
- "/registro"    Nombre, correo, contraseña (mín. 8), aceptar términos.
- "/login"       Correo + contraseña, "Olvidé mi contraseña".
- "/recuperar"   Restablecer contraseña por correo.
- "/verificar/:codigo"  Página pública de verificación de un sorteo (ver punto 8).
- "/terminos" y "/privacidad".

Privadas (requieren sesión):
- "/app"              Panel: saldo de sorteos, botón "Nuevo sorteo", últimos sorteos.
- "/app/nuevo"        Asistente del sorteo (5 pasos, punto 5).
- "/app/sorteos"      Historial con buscador y filtro por fecha.
- "/app/sorteos/:id"  Detalle: ganadores, suplentes, reglas, huella, descargar acta PDF,
                      copiar ganadores, enlace público de verificación.
- "/app/comprar"      Compra de paquetes de sorteos.
- "/app/cuenta"       Perfil, cambiar contraseña, historial de compras y de movimientos de créditos.

Administrador (rol admin):
- "/admin"  Métricas (usuarios, sorteos realizados, ventas, ingresos), lista de usuarios con
            buscador, ajustar créditos manualmente (con motivo obligatorio), ver compras,
            suspender usuarios.

==================================================
3. AUTENTICACIÓN
==================================================
- Registro con correo y contraseña (hash seguro, nunca en texto plano).
- Verificación de correo obligatoria antes del primer sorteo (los créditos gratis se
  asignan al verificar el correo, para evitar cuentas falsas).
- Recuperación de contraseña por correo.
- Sesiones seguras; cerrar sesión.
- Límite de intentos de login (protección contra fuerza bruta).
- Un correo = una cuenta. Normalizar correos (minúsculas, sin espacios).

==================================================
4. BASE DE DATOS
==================================================
Tabla users
  id, nombre, email (único), password_hash, email_verificado (bool), rol ('user'|'admin'),
  creditos_disponibles (int, default 0), creditos_gratis_otorgados (bool, default false),
  estado ('activo'|'suspendido'), creado_en, ultimo_login

Tabla credit_transactions   (libro contable: el saldo SIEMPRE debe cuadrar con esta tabla)
  id, user_id, tipo ('bono_registro'|'compra'|'consumo_sorteo'|'ajuste_admin'|'reembolso'),
  cantidad (int, positivo suma / negativo resta), saldo_resultante, referencia
  (id de compra o id de sorteo), nota, creado_en

Tabla purchases
  id, user_id, paquete ('pack_10'), creditos (10), monto (10.00), moneda ('USD'),
  proveedor ('stripe'), id_pago_proveedor (único), estado ('pendiente'|'pagado'|'fallido'|'reembolsado'),
  creado_en, pagado_en

Tabla raffles   (sorteos)
  id, user_id, codigo_verificacion (único, 10 caracteres, p. ej. "K7P2-QX9M"),
  titulo_premio, cuenta_organizadora, url_publicacion,
  fuente ('extractor'|'pegar'|'archivo'|'api'),
  reglas (JSON: excluidas, min_menciones, palabra_clave, modalidad 'persona'|'comentario',
          excluidos_manual),
  total_comentarios, total_personas, total_validos, total_oportunidades,
  num_ganadores, num_suplentes,
  huella_sha256, semilla_aleatoria (guardada para auditoría),
  estado ('completado'), creado_en

Tabla raffle_participants
  id, raffle_id, username, oportunidades (int)
  (lista de participantes VÁLIDOS en el momento del sorteo; puede guardarse también como
   JSON comprimido en raffles si hay muchas filas)

Tabla raffle_winners
  id, raffle_id, posicion (1..n), tipo ('ganador'|'suplente'), username

Índices: users.email, raffles.user_id, raffles.codigo_verificacion,
purchases.id_pago_proveedor, credit_transactions.user_id.

==================================================
5. ASISTENTE "NUEVO SORTEO" (/app/nuevo)
==================================================
Arriba siempre visible: "Te quedan X sorteos". Si X = 0, mostrar aviso y botón
"Comprar 10 sorteos por 10 USD" (los pasos 1 a 3 se pueden usar igual; sólo se bloquea el
botón de sortear).

PASO 1 – Datos: premio / nombre del sorteo, cuenta organizadora (@), URL de la publicación.

PASO 2 – Cargar participantes (4 pestañas):
 (a) "⚡ Extractor automático" (recomendado). Mostrar un botón-marcador (bookmarklet) para
     arrastrar a la barra de marcadores + botón "Copiar código" (por si el navegador no deja
     arrastrar) + instrucciones con imágenes: 1) arrastra el botón, 2) abre tu publicación en
     instagram.com con sesión iniciada, 3) pulsa el marcador, 4) pulsa "Copiar resultado",
     5) vuelve aquí y pulsa "Pegar del portapapeles".
     El bookmarklet (JavaScript que corre en instagram.com con la sesión del usuario):
       - Valida que el dominio sea instagram.com y la URL contenga /p/, /reel/ o /tv/.
       - Convierte el shortcode en ID numérico (alfabeto
         "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", base 64, BigInt);
         alternativa: meta[property="al:ios:url"] → media?id=NNN.
       - GET https://www.instagram.com/api/v1/media/{id}/comments/?can_support_threading=true
         con credentials:'include' y cabeceras X-IG-App-ID: 936619743392459,
         X-Requested-With: XMLHttpRequest, X-CSRFToken (cookie csrftoken).
       - Pagina con next_min_id / next_max_id; pausa aleatoria de 0,7–1,3 s entre páginas.
       - Pregunta si incluir respuestas; si sí, recorre
         /media/{id}/comments/{pk}/child_comments/.
       - Ante 429 espera 20/40/60 s y reintenta (máx. 4); ante 401/403 pide iniciar sesión.
       - Panel flotante con la marca de la app: progreso, Cancelar, "Copiar resultado",
         "Descargar .json".
       - Resultado JSON: { source:"sorteos-ig-extractor", version:1, shortcode, permalink,
         post_owner, extracted_at, incomplete, replies_included,
         comments:[{id, username, text, timestamp, parent_id}] }
     Al pegar ese JSON en la app: rellenar URL y organizador si están vacíos y añadir
     automáticamente al dueño de la publicación a "Excluir cuentas".
 (b) "📋 Pegar comentarios": área de texto con 3 modos:
       - Comentarios copiados de instagram.com: una línea con forma de usuario
         (^[a-z0-9._]{1,30}$, no sólo números, sin punto al inicio/fin ni "..") inicia un
         comentario; las siguientes son su texto. Ignorar ruido de la interfaz en ES/EN/PT
         ("Responder", "Reply", "3 sem", "2 d", "12 Me gusta", "Ver traducción",
         "Ver respuestas", "Verificado", "Autor", "Seguir"...). Aceptar también "usuario: texto".
       - Lista de usuarios (separados por líneas, comas o espacios).
       - Sólo @menciones del texto.
       Botón "Cargar ejemplo" con datos ficticios.
 (c) "📁 Importar archivo": .csv / .json / .txt, varios a la vez, arrastrar y soltar.
       CSV: detectar separador (, ; tab) y comillas; columna usuario por nombre
       (username, user, usuario, autor, author, owner, handle) y texto
       (text, comment, comentario, message, mensaje); sin encabezado → col1 usuario, col2 texto.
       JSON: recorrer recursivamente (incluye data, replies.data, comments.data).
 (d) "🔌 API de Instagram" (avanzado): token de cuenta profesional; si empieza por "IG" usar
       graph.instagram.com/v21.0/me, si no graph.facebook.com/v21.0/me/accounts
       {instagram_business_account}. Listar hasta 100 publicaciones en cuadrícula (miniatura,
       nº comentarios, texto) y descargar todos los comentarios con paginación.
       EL TOKEN NUNCA SE GUARDA en la base de datos ni en el servidor.

PASO 3 – Participantes y reglas:
 - Agrupar comentarios por usuario (minúsculas): textos[], menciones distintas (sin contarse
   a sí mismo).
 - Reglas: excluir cuentas (@a, @b), mínimo de amigos etiquetados, palabra o #hashtag
   obligatorio (sin distinguir mayúsculas), modalidad "1 oportunidad por persona" o
   "1 por comentario".
 - Contadores: comentarios, personas únicas, válidos, oportunidades.
 - Tabla con buscador (renderizar máx. 1000 filas): #, @usuario + comentario de muestra,
   nº comentarios, nº etiquetas, estado (pastilla "Válido" o el motivo: "Cuenta excluida",
   "Etiquetó X de N", "Falta palabra clave", "Excluido a mano") y casilla para excluir a mano.
 - Aviso si los datos no tienen texto y hay reglas que dependen del texto.
 - Exportar CSV (usuario,comentarios,etiquetas,valido,oportunidades,motivo, UTF-8 con BOM)
   y "Vaciar lista".
 - Guardar el borrador del asistente en el navegador (localStorage) para no perderlo al
   recargar; avisar antes de salir si hay datos.

PASO 4 – Sorteo:
 - Campos: nº de ganadores (≥1), nº de suplentes (≥0), segundos de suspenso (2–15), sonido.
 - Validar ganadores + suplentes ≤ participantes válidos.
 - Modal de confirmación: "Este sorteo usará 1 de tus X sorteos disponibles. ¿Continuar?"
 - Al confirmar, la app envía al SERVIDOR: datos del paso 1, reglas, totales y la lista de
   participantes válidos [{username, oportunidades}].
 - EL SERVIDOR (no el navegador) hace todo esto en UNA TRANSACCIÓN atómica:
     1. Verifica sesión, correo verificado, cuenta activa y creditos_disponibles ≥ 1
        (bloquear la fila del usuario para evitar doble gasto con dos clics/pestañas).
     2. Calcula la huella SHA-256 de la lista ordenada alfabéticamente "usuario:oportunidades"
        unida por saltos de línea.
     3. Genera una semilla aleatoria criptográfica y elige ganadores + suplentes con un
        generador criptográfico (sin sesgo de módulo, muestreo por rechazo), ponderando por
        oportunidades y SIN REPETIR (cada elegido sale del bombo). Los primeros N son
        ganadores; el resto, suplentes en orden.
     4. Guarda raffles, raffle_participants y raffle_winners; genera codigo_verificacion.
     5. Resta 1 crédito y registra credit_transactions (tipo 'consumo_sorteo', -1,
        referencia = raffle.id).
     6. Si algo falla, revertir todo: no se cobra un sorteo que no quedó guardado.
   Responde con los ganadores, suplentes, huella, código y saldo restante.
   Protección extra: clave de idempotencia por envío para que un doble clic no gaste 2 créditos.
 - Luego el navegador muestra la ANIMACIÓN (sólo es visual; el resultado ya está guardado):
     overlay a pantalla completa → cuenta regresiva 3-2-1 con sonido grave →
     ruleta de nombres aleatorios del bombo que se va frenando
     (pausa entre nombres = 35 + 520·t³ ms, t de 0 a 1 durante los segundos de suspenso;
     mensajes "Mezclando participantes…", "Se está frenando…", "¡Casi!"; a partir del 65 %
     efecto de tensión) → aparece el ganador con acorde de victoria y confeti
     (canvas-confetti con los colores de la marca) → botón "Siguiente ganador ➜" /
     "Sortear suplentes ➜" (los suplentes giran a la mitad del tiempo) → "Ver resultados".
     Sonidos generados con Web Audio API (osciladores), sin archivos.

PASO 5 – Resultado (también en /app/sorteos/:id):
 - Tarjetas de ganadores y suplentes con enlace a instagram.com/usuario.
 - Totales, fecha y hora, huella SHA-256, código de verificación y enlace público
   /verificar/:codigo con botón copiar.
 - "📄 Descargar acta PDF", "📋 Copiar ganadores" (texto listo para publicar, incluye el
   enlace de verificación), "🔁 Hacer otro sorteo" (vuelve al paso 4 con la misma lista y
   consume otro crédito; avisarlo).
 - Ver de nuevo la animación desde el historial NO consume créditos.

==================================================
6. ACTA EN PDF (generar en el navegador con jsPDF 2.5.1 + jspdf-autotable 3.8.2)
==================================================
- A4. Cabecera con logo y nombre de la app, título "Acta de sorteo", subtítulo = premio,
  franja con el degradado de la marca.
- Tabla de datos: premio, organizador, publicación, fecha y hora, comentarios analizados,
  personas únicas, participantes válidos, oportunidades, modalidad, reglas aplicadas,
  método ("Selección aleatoria criptográfica en servidor, sin repetición"), huella SHA-256,
  código de verificación y URL de verificación.
- Tabla de ganadores y suplentes (puesto, usuario, tipo, perfil).
- Nota: "Los suplentes reemplazan, en orden, a los ganadores que no reclamen el premio o no
  cumplan las bases. La huella permite comprobar que la lista de participantes no fue modificada."
- Anexo: todos los participantes válidos en 3 columnas, ordenados alfabéticamente, con los
  ganadores resaltados; si es "por comentario", mostrar oportunidades entre paréntesis.
- Pie en cada página: "APP Sorteos IG - Free · Código: XXXX-XXXX · Página X de Y".
- Quitar emojis del texto del PDF (las fuentes estándar sólo cubren Latin-1).

==================================================
7. CRÉDITOS Y PAGOS
==================================================
- Bono de bienvenida: 3 sorteos gratis, UNA sola vez por cuenta, al verificar el correo
  (usar creditos_gratis_otorgados para no repetirlo). Registrar transacción 'bono_registro' +3.
- 1 sorteo realizado = 1 crédito (sin importar nº de ganadores o participantes).
- Paquete único: "10 sorteos por 10 USD" (pago único, no suscripción). Se pueden comprar
  tantos paquetes como se quiera; los créditos se suman y no vencen.
- Cobro con Stripe a través de la integración de pagos de GoHighLevel (checkout seguro;
  la app nunca toca datos de tarjeta).
- Los créditos se acreditan SÓLO cuando el servidor recibe la confirmación del pago por
  webhook (no al volver de la página de pago). El webhook debe ser idempotente: si llega dos
  veces con el mismo id_pago_proveedor, no sumar dos veces. Registrar transacción 'compra' +10.
- Página de retorno: "¡Pago recibido! Ya tienes X sorteos" (consultando el saldo; si el
  webhook aún no llegó, mostrar "Procesando pago…" y refrescar cada pocos segundos).
- Reembolso (admin): marca la compra como 'reembolsado' y resta los créditos no usados.
- Avisos: cuando quede 1 crédito ("Te queda 1 sorteo") y al llegar a 0 (banner + correo con
  enlace de compra).
- El saldo mostrado en la interfaz siempre se lee del servidor; nunca confiar en el navegador.

==================================================
8. VERIFICACIÓN PÚBLICA (/verificar/:codigo)
==================================================
Página pública, sin sesión, que muestra: premio, cuenta organizadora, URL de la publicación,
fecha y hora, reglas, totales, ganadores y suplentes, huella SHA-256 y la lista de
participantes (paginada, con buscador "¿Participé?"). Botón para descargar el acta.
No mostrar datos personales del usuario de la app (sólo la cuenta organizadora que escribió).

==================================================
9. INTEGRACIÓN CON EL CRM DE GOHIGHLEVEL
==================================================
- Al registrarse: crear/actualizar contacto (nombre, correo) con etiqueta "sorteos-ig-registro".
- Al verificar correo: etiqueta "sorteos-ig-activo".
- Al realizar el primer sorteo: etiqueta "sorteos-ig-primer-sorteo".
- Al quedarse sin créditos: etiqueta "sorteos-ig-sin-creditos" (para un workflow de
  recuperación con correo/WhatsApp ofreciendo el paquete).
- Al comprar: etiqueta "sorteos-ig-comprador" y campo personalizado con total de compras.
- Correos transaccionales: verificación de correo, recuperación de contraseña, bienvenida
  (explica los 3 sorteos gratis), confirmación de compra, aviso de 0 créditos.

==================================================
10. SEGURIDAD Y REGLAS DE NEGOCIO
==================================================
- Toda lógica de créditos, sorteo y guardado se ejecuta en el servidor; el navegador sólo
  prepara la lista y anima.
- Cada usuario sólo puede ver sus sorteos (validar user_id en cada consulta); el admin todo.
- Validar en servidor: username con ^[a-z0-9._]{1,30}$, oportunidades enteras ≥1,
  ganadores ≥1, ganadores + suplentes ≤ participantes, máximo 100.000 participantes por sorteo.
- Escapar todo el texto mostrado (los comentarios de Instagram pueden traer HTML o scripts).
- Límite de peticiones en registro, login y creación de sorteos.
- Un usuario suspendido no puede iniciar sesión ni sortear.
- Los sorteos guardados no se pueden editar ni borrar (inmutables, para que la verificación
  tenga valor). El usuario sí puede ocultarlos de su historial.
- Mostrar en el pie: "Esta app no está afiliada a Instagram ni a Meta. Usa el extractor sólo
  con tus publicaciones o con permiso de la cuenta."

==================================================
11. TEXTOS LEGALES Y FAQ
==================================================
FAQ: ¿Es gratis? (3 sorteos gratis, luego 10 USD por 10) · ¿Los créditos vencen? (No) ·
¿Cuenta como sorteo repetir la animación? (No) · ¿Y hacer otro sorteo con la misma lista? (Sí) ·
¿Cómo sé que es justo? (azar criptográfico en servidor, huella SHA-256 y página pública de
verificación) · ¿Necesito dar mi contraseña de Instagram? (No, nunca) · ¿Funciona en el móvil?
(La app sí; el extractor automático requiere navegador de computador; en el móvil usa
"Pegar comentarios" o "Importar archivo").
Términos y privacidad básicos: qué datos se guardan (cuenta, sorteos, listas de usuarios de
Instagram participantes), para qué, y cómo solicitar la eliminación de la cuenta.

==================================================
12. CRITERIOS DE ACEPTACIÓN
==================================================
1. Un usuario nuevo se registra, verifica su correo y ve "Te quedan 3 sorteos".
2. Hace 3 sorteos; cada uno queda en el historial con su PDF y su enlace de verificación,
   y el saldo baja 3 → 2 → 1 → 0.
3. Con 0 créditos no puede sortear y se le ofrece el paquete; tras pagar 10 USD ve 10 sorteos.
4. Dos clics rápidos en "Iniciar sorteo" consumen un solo crédito.
5. El webhook de pago recibido dos veces suma 10 créditos una sola vez.
6. La página /verificar/:codigo funciona sin sesión y coincide con el PDF.
7. Nunca sale el mismo usuario dos veces entre ganadores y suplentes.
8. La suma de credit_transactions de cada usuario es igual a creditos_disponibles.
9. Todo se ve y funciona bien en móvil y en computador.
```
