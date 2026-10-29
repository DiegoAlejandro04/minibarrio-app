# MiniBarrio

MiniBarrio es una plataforma digital de portafolio comercial y recomendación
para microcomercios locales. Permite a un negocio de belleza (barberías y
estética) publicar su catálogo de servicios, precios, equipo y portafolio de
trabajos, y permite a los clientes descubrir negocios cercanos, recibir
recomendaciones, agendar citas, dejar reseñas y guardar sus favoritos.

> **Alcance del prototipo:** cubre exclusivamente barberías y estética del
> barrio Britalia (Kennedy, Bogotá D.C.), con dos tipos de usuario —
> **cliente** y **propietario de negocio** (sin rol de administrador).

**Versión publicada:** https://minibarrio-c8b21.web.app

## Funcionalidades principales

### Vitrina pública (`/`, sin necesidad de iniciar sesión)
- Mapa interactivo de Britalia con los negocios registrados (agrupados cuando
  están cerca) y botón **"Usar mi ubicación"** para encontrar los más cercanos.
- Búsqueda por servicio, filtros (por ejemplo, "Abiertos ahora") y presupuesto.
- **Recomendador** (RF-09): ordena los negocios combinando precio, historial
  del cliente, calificación, cercanía y tipo de servicio, con los pesos
  obtenidos de la encuesta del estudio (ver `src/recomendador.js`).
- Sección "Cómo funciona" y carrusel de reseñas recientes (sin mostrar el
  nombre de quien reseña, por privacidad).
- Formularios de PQRS y Contacto en el pie de página.

### Perfil público de cada negocio (`/negocio/:id`)
- Portada, logo, descripción, horario, ubicación, métodos de pago, reseñas y
  galería de trabajos.
- **Reserva de citas:** el cliente elige el servicio, la persona del equipo que
  lo atiende (o "Cualquiera") y el día; solo se ofrecen los turnos libres de
  20 minutos dentro del horario del negocio y de esa persona, sin cruzarse con
  su hora de almuerzo ni con otras citas. Las citas se reservan con al menos un
  día de anticipación.
- Comprobante de la reserva con número de cita.
- **Canales de contacto** (RF-11): la propia página, WhatsApp y llamada
  telefónica. Los datos de contacto del negocio solo se muestran con sesión
  iniciada.

### Panel del cliente (`/perfil`)
- **Principal:** resumen de actividad, próximas citas e historial.
- **Mis citas:** próximas citas (con opción de cancelarlas) e historial
  paginado. Si el negocio avisa de un contratiempo, el cliente puede
  reprogramar la cita o escribirle por WhatsApp.
- **Favoritos** y **Mis reseñas** (calificación verificada: solo después de
  una cita propia en ese negocio).
- **Notificaciones** en tiempo real: reservas, recordatorios (el día anterior y
  una hora antes), cancelaciones e invitaciones a calificar.
- **Datos personales:** nombre, teléfono y **foto de perfil**, que se ve en el
  panel, en el encabezado de la vitrina y en la agenda del negocio.

### Panel del propietario (`/panel`)
- **Resumen:** visitas al perfil, citas agendadas, calificación e ingresos
  estimados (semanal, mensual y por semestre), con gráfica de **visitas** o de
  **citas agendadas** por semana o por mes.
- **Agenda:** calendario mensual de citas, búsqueda por número de reserva y
  cambio de estado (*Reservada*, *En proceso* con cronómetro, *Cancelada*,
  *Realizada*). Con una cita en proceso, el panel avisa 15 minutos antes de la
  siguiente; el negocio confirma que va a tiempo o avisa al cliente de un
  contratiempo.
- **Caja:** registro de servicios atendidos fuera de la plataforma (del
  catálogo, con cobro adicional o personalizados), que suman a las citas y a
  los ingresos del resumen.
- **Servicios**, **Equipo** (personas con foto, cargo, días de trabajo, horario
  propio y hora de almuerzo), **Identidad** (datos, horario, ubicación y
  contacto), **Portafolio**, **Reseñas**, **Clientes** y **Configuración**.
- Campana de notificaciones y barra de progreso del perfil con el siguiente
  paso recomendado.

### Cuentas y seguridad
- Registro e inicio de sesión con correo y contraseña o con Google, con
  enrutamiento y permisos según el rol del usuario.
- Registro solo con correos de proveedores reconocidos (Gmail, Outlook,
  Hotmail, Yahoo, iCloud, entre otros) y contraseña segura (8 o más
  caracteres, con mayúscula, minúscula, número y carácter especial).
- Autorización de tratamiento de datos personales (Ley 1581 de 2012). Un
  negocio solo puede ver los datos de un cliente que reservó o reseñó en él.
- Reglas de seguridad de Firestore (`firestore.rules`) que validan cada
  escritura, y Firebase App Check con reCAPTCHA Enterprise.

### Experiencia de uso
- Diseño adaptable a computador, Android e iPhone, con modo claro y oscuro.
- Estilo de "vidrio" en la interfaz (en celulares, una versión liviana sin
  desenfoque para mejor rendimiento).
- Carga optimizada: cada página se descarga solo al entrar a ella y los datos
  se guardan en caché local para las siguientes visitas.

## Stack tecnológico

- **Frontend:** React 18 + [Vite](https://vitejs.dev) 5
- **Enrutamiento:** React Router 6
- **Backend como servicio:** [Firebase](https://firebase.google.com) —
  Authentication, Cloud Firestore, App Check y Hosting
- **Mapas:** [Leaflet](https://leafletjs.com) con mapas de
  [OpenStreetMap](https://www.openstreetmap.org) y direcciones con Nominatim
  (no requiere API key)
- **Correos de los formularios:** [EmailJS](https://www.emailjs.com)

Para más detalle: `docs/ARQUITECTURA.md` (arquitectura), `docs/MODELO_DATOS.md`
(modelo de datos) y `docs/UML.md` (diagramas de casos de uso, clases,
secuencia y despliegue).

## Requisitos previos

- [Node.js](https://nodejs.org) 20 o superior (incluye `npm`)
- Credenciales de un proyecto de [Firebase](https://console.firebase.google.com)
  con **Authentication** (correo/contraseña y Google) y **Firestore** habilitados

## Instalación

```bash
git clone https://github.com/DiegoAlejandro04/minibarrio-app.git
cd minibarrio-app
npm install
```

Crea un archivo `.env` en la raíz del proyecto con las credenciales de tu
proyecto de Firebase (Firebase Console → Configuración del proyecto → Tus
apps → SDK setup and configuration → Config):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`.env` está en `.gitignore` y nunca se sube al repositorio. Las reglas de
seguridad de Firestore están en `firestore.rules`; despliégalas a tu proyecto
con `firebase deploy --only firestore:rules` (requiere el
[Firebase CLI](https://firebase.google.com/docs/cli)) o pégalas en Firebase
Console → Firestore → Reglas → Publicar.

El mapa no necesita configuración adicional: usa OpenStreetMap, que es
gratuito y no pide API key.

## Uso

```bash
npm run dev
```

Abre `http://localhost:5173`. Desde ahí puedes:

- Explorar la vitrina pública de negocios en `/`
- Registrarte como cliente (`/registro/cliente`) para agendar citas, guardar
  favoritos y dejar reseñas desde `/perfil`
- Registrar un negocio (`/registro/negocio`) para gestionarlo desde `/panel`
  como propietario

En desarrollo, agrega `?demo` a la dirección (por ejemplo
`http://localhost:5173/?demo=2`) para ver la vitrina con negocios y reseñas de
ejemplo. No escribe nada en Firestore ni llega a la versión publicada.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo con recarga en caliente |
| `npm run build` | Genera el build de producción en `dist/` |
| `npm run preview` | Sirve localmente el build de `dist/` para probarlo antes de desplegar |
| `npm run lint` | Revisa el código con ESLint |
| `npm test` | Ejecuta las pruebas del recomendador y del cálculo de turnos del equipo |

### Despliegue

```bash
npm run build
firebase deploy --only hosting
```

## Estructura del proyecto

```
src/
├─ components/     Componentes compartidos (menú de los paneles, modales,
│                  notificaciones, recibo, selector de hora, iconos…)
├─ context/        Contexto de autenticación (sesión, rol, modo oscuro, foto)
├─ firebase/       Configuración de Firebase (Auth, Firestore, App Check)
├─ hooks/          Hooks reutilizables (equipo, notificaciones, celular)
├─ maps/           Mapa (Leaflet + OpenStreetMap) y búsqueda de direcciones
├─ pages/
│  ├─ client/       Vitrina pública, perfil del negocio y panel del cliente
│  └─ owner/        Panel del propietario del negocio (/panel)
├─ routes/         Rutas protegidas por rol
├─ recomendador.js Motor de recomendación (con pruebas en recomendador.test.js)
├─ equipo.js       Horarios, almuerzo y disponibilidad del equipo (con pruebas)
├─ turnosOcupados.js Reserva de turnos sin cruces entre citas
└─ notificaciones.js Notificaciones entre clientes y negocios
```

## Equipo

Proyecto de grado desarrollado por Juan David
([@Juancho-456](https://github.com/Juancho-456)) y Diego Alejandro
([@DiegoAlejandro04](https://github.com/DiegoAlejandro04)).

## Licencia

Uso académico — Universidad Católica de Colombia.
