# eProfy (React + Vite) · versión Prueba 07

Cuaderno del profesor para el instituto. Cada usuario tiene sus **colegios**, y cada colegio usa una de dos versiones:

- **Reducida:** Hoy, Grupos, Horario (horario semanal + configurador, con clases, guardias, tutorías, reuniones y horas libres) y Planificador (bloques Eventos y Tareas, cada uno con su calendario mensual).
- **Completa:** lo mismo más Notas (cuaderno por criterios LOMLOE) y Asistencia.

Ajustes se abre con la rueda dentada de arriba. Incluye días no lectivos, cambios puntuales de clase, exportación a Excel y copias de seguridad. Es una PWA instalable que se adapta al móvil y al PC y sincroniza los datos con Firebase.

Todo funciona con planes gratuitos: GitHub Free, Vercel Hobby y Firebase Spark.

```
Móvil (app instalada) ─┐
                       ├──►  Firebase Firestore (tu proyecto, servidor en Europa)
Portátil (navegador)  ─┘        users/{tu-uid}/docs/...
        ▲
        └── la web la publica Vercel desde GitHub (https://eprofy.vercel.app)
```

## Desarrollo local

```bash
npm install
npm run dev
```

Se abre en `http://localhost:5173`. Firebase autoriza `localhost` por defecto.

---

## 1. Crear el proyecto de Firebase (unos 10 minutos, gratis)

1. Entra en **console.firebase.google.com** y pulsa **Crear proyecto**. Llámalo `eprofy`. Puedes desactivar Google Analytics.
2. **Base de datos.** Ve a *Compilación → Firestore Database → Crear base de datos*.
   - Elige **modo de producción**.
   - Como ubicación, elige `europe-southwest1 (Madrid)`. **No se puede cambiar después.**
3. **Reglas de seguridad.** En Firestore, abre la pestaña *Reglas*, pega el contenido de `firestore.rules` y pulsa **Publicar**.
4. **Inicio de sesión.** En *Compilación → Authentication → Método de acceso*, activa **Correo electrónico/contraseña** y **Google**.
5. **Conectar la web.** Ve a *Configuración del proyecto → General → Tus apps* y pulsa **`</>`** (Web). Registra la app con el nombre `eProfy` y copia los valores de `firebaseConfig` en **`src/firebase-config.js`**.

> Los valores de `firebase-config.js` no son secretos y pueden ir en el repositorio. Lo que protege los datos son las reglas del paso 3.
>
> No aceptes pasar al plan **Blaze** aunque la consola lo sugiera: eProfy solo usa productos del plan gratuito.

## 2. Publicar con GitHub + Vercel

```bash
git init
git add .
git commit -m "eProfy"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/eprofy.git
git push -u origin main
```

1. En **vercel.com**, pulsa *Add New → Project*, elige `eprofy` y pulsa **Deploy**. Vercel detecta Vite solo: *Build Command* `npm run build` y *Output Directory* `dist`.
2. En Firebase, ve a *Authentication → Configuración → Dominios autorizados* y añade tu dominio de Vercel, por ejemplo `eprofy.vercel.app`.
3. Para que funcione **«Continuar con Google»**, el inicio de sesión pasa por tu propio dominio (`vercel.json` reenvía `/__/auth` a Firebase). Hay que autorizarlo una vez en Google Cloud:
   - Entra en **console.cloud.google.com**, elige el proyecto `eprofy`, y ve a *APIs y servicios → Credenciales*.
   - Abre **«Web client (auto created by Google Service)»**.
   - En *Orígenes autorizados de JavaScript*, añade `https://TU-DOMINIO.vercel.app`.
   - En *URI de redireccionamiento autorizados*, añade `https://TU-DOMINIO.vercel.app/__/auth/handler`.
   - Pulsa **Guardar** y espera unos minutos.

Cada `git push` a `main` publica una versión nueva automáticamente.

## 3. Instalarla

- **Android (Chrome):** menú ⋮ → **Instalar aplicación**.
- **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.
- **PC (Chrome o Edge):** icono de instalar en la barra de direcciones.

Entra con la misma cuenta en todos los dispositivos.

## Si algo no funciona

eProfy indica en **Ajustes → Cuenta y sincronización** qué falta. La app siempre se puede usar e instalar, aunque Firebase no esté listo: los datos se guardan en el dispositivo y se suben solos cuando la conexión funcione.

| Mensaje | Qué hacer |
|---|---|
| «La sincronización entre dispositivos aún no está activada» | Pega los datos de tu proyecto en `src/firebase-config.js` (paso 1.5) y sube el cambio a GitHub. |
| «El inicio de sesión no está activado» | Firebase → Authentication → Comenzar → activa Correo y Google (paso 1.4). |
| «Este dominio no está autorizado» | Añade tu dominio de Vercel en Authentication → Configuración → Dominios autorizados. |
| «La base de datos no existe todavía» | Crea la base de datos en Firestore Database (paso 1.2). |
| «Firebase no deja leer los datos» | Publica las reglas de `firestore.rules` (paso 1.3). |
| Google abre una página con «redirect_uri_mismatch» | Falta el paso 2.3: añadir tu dominio en Google Cloud → Credenciales. |
| Pulsas «Continuar con Google» y no pasa nada | Revisa los pasos 2.2 y 2.3. Mientras tanto puedes entrar con correo y contraseña. |
| «La apiKey no es válida» | Vuelve a copiar `firebaseConfig` desde la consola de Firebase. |


---

## Notas técnicas

- **Datos:** se guardan como documentos JSON en `users/{uid}/docs/{id}` (ver `src/lib/model.js` y `src/store/store.js`):
  - `schools`: lista de colegios (nombre y versión Reducida/Completa).
  - `<colegio>.meta`: grupos, horario, eventos, días no lectivos, cambios puntuales y ajustes del colegio.
  - `<colegio>.g_<grupo>`: alumnos, criterios, actividades (tareas, exámenes y notas) y entregas.
  - `<colegio>.a_<grupo>`: asistencia y anotaciones.
  - `<colegio>.diary`: ficha de cada día del Planificador (Planificado, Realizado y pendientes).
  - Los datos anteriores a los colegios se pasan solos a un colegio «Mi colegio» (versión Completa).
- **Sin conexión:** Firestore guarda una caché en el dispositivo y envía los cambios al volver la red. Además hay una copia local para arrancar al instante.
- **Migraciones:** `SCHEMA` y `migrate()` en `src/lib/model.js` convierten datos antiguos al formato actual, al abrir la app y al importar una copia. Si cambias la forma de los datos, sube `SCHEMA` y añade el paso correspondiente.
- **Deshacer:** todo cambio pasa por `change()` en `src/store/store.js`, que devuelve la función que lo deshace. Los borrados muestran un aviso con el botón «Deshacer».
- **Cálculo de notas:** en `src/lib/grades.js`. La nota de un criterio es la media ponderada de sus actividades; la del periodo, la media de los criterios evaluados ponderada por su peso.
- **Horario:** en `src/lib/schedule.js`. Una sesión fija semanal, más los cambios de un día (cancelar, mover, añadir), menos los días no lectivos.
- **Excel:** la librería `xlsx` se descarga solo al exportar.
- **Fuentes:** Bricolage Grotesque, Atkinson Hyperlegible e IBM Plex Mono, incluidas con `@fontsource`. Funcionan sin conexión.
- **Service worker:** está en `public/sw.js`. Sube `VERSION` si cambias algo de la propia app que deba limpiarse de la caché de los dispositivos.

## Estructura

```
src/
  lib/          fechas, modelo y migraciones, notas, horario, Excel, datos de ejemplo, formato móvil/PC
  store/        store.js (datos, sincronización con Firestore, deshacer) y actions.js
  components/   ui (ventanas, avisos, piezas), ClassCard, common
  modals/       ventanas de grupos, alumnos, criterios, actividades, eventos, horario, días no lectivos, Excel
  views/        Acceso (entrada y colegios), Hoy, Grupos, Notas, Asistencia, Horario, Planificador, Ajustes
  App.jsx       acceso, navegación y estructura
public/         manifest, service worker e iconos
```

## Protección de datos

Las notas y faltas son datos personales de alumnado menor de edad. Antes de usar eProfy con datos reales, consulta con tu centro o con el delegado de protección de datos de la Consejería. Mantén la base de datos en Europa y, si quieres reducir riesgos, usa nombres abreviados.
