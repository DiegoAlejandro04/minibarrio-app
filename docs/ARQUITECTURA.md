# Arquitectura de software — MiniBarrio (Objetivo específico 2)

Corresponde a la actividad 2.1 del cronograma: definición de la arquitectura
general del sistema.

## Estilo arquitectónico

**Cliente-servidor con backend como servicio (BaaS)**, tal como se planteó en
el anteproyecto: el frontend (React) corre completamente en el navegador del
usuario y habla directamente, por HTTPS, con los servicios administrados de
Firebase — no hay un servidor backend propio que mantener.

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React 18 + Vite + React Router | Interfaz de usuario, ambos roles (cliente/propietario) |
| Autenticación | Firebase Authentication | Registro/login por correo y contraseña, sesión |
| Datos | Cloud Firestore | Usuarios, negocios, servicios, citas, reseñas (ver `MODELO_DATOS.md`) |
| Hosting | Firebase Hosting | Sirve el build estático de React sobre CDN |

Ver `docs/UML.md` (§4) para el diagrama de despliegue completo.

## Por qué Vite en vez de Create React App

El anteproyecto menciona "React.js" como framework de frontend sin fijar la
herramienta de build. Create React App (CRA) está oficialmente descontinuado
desde 2025; Vite es hoy el estándar de facto para proyectos React nuevos:
arranca el servidor de desarrollo en milisegundos (vs. varios segundos con
CRA) y su build de producción es más liviano. Sigue siendo 100% "React.js"
— solo cambia la herramienta que empaqueta el código, no la librería.

## Estructura de carpetas

```
src/
├── firebase/
│   └── config.js          # Inicializa Firebase (Auth + Firestore) desde variables de entorno
├── context/
│   └── AuthContext.jsx    # Estado global de sesión y rol; registerClient / registerBusinessOwner / login / logout
├── routes/
│   └── ProtectedRoute.jsx # Protege rutas por sesión y, opcionalmente, por rol
├── components/
│   └── Navbar.jsx         # Barra superior compartida
├── pages/
│   ├── Login.jsx
│   ├── RegisterClient.jsx
│   ├── RegisterBusiness.jsx
│   ├── client/
│   │   └── ClientHome.jsx     # Punto de partida del Sprint 2 (búsqueda, mapa, recomendaciones)
│   └── owner/
│       └── OwnerDashboard.jsx # Punto de partida del Sprint 1 (portafolio, agenda)
├── App.jsx                 # Definición de rutas
└── main.jsx                 # Punto de entrada; envuelve la app en <AuthProvider> y <BrowserRouter>
```

Esta estructura separa por *responsabilidad* (no por rol) a nivel de
infraestructura (`firebase/`, `context/`, `routes/`) y por *rol* a nivel de
páginas (`pages/client/`, `pages/owner/`), que es como está repartido el
trabajo en el cronograma (Sprint 1 = Diego en auth, Juan David en portafolio,
etc. — cada quien puede trabajar en su carpeta sin pisarse con el otro en
Git).

## Decisiones de diseño relevantes

- **El rol vive en Firestore, no solo en el token de Auth.** Firebase
  Authentication no tiene un campo nativo de "rol"; se guarda en el
  documento `usuarios/{uid}` y las reglas de seguridad (`firestore.rules`)
  lo verifican en cada operación. Esto es lo que hace posible, a futuro,
  cambiar el rol de un usuario desde una consola de administración sin
  tocar código.
- **Un negocio por propietario** (`negocioId == uid`): decisión deliberada
  para simplificar el prototipo (ver `MODELO_DATOS.md`), coherente con la
  población de 35-45 barberías caracterizada en la encuesta.
- **RNF-07 (escalabilidad)** se satisface a nivel de *modelo de datos*
  (campo `categoria` existe, aunque fijo por ahora) y de *arquitectura*
  (Firestore no tiene esquema rígido: agregar otra categoría de
  microcomercio en el futuro no requiere migración), no agregando UI o
  flujos para otras categorías en este prototipo — eso está fuera de
  alcance según el documento de trabajo de grado.
