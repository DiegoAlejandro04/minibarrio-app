# MiniBarrio

Prototipo de plataforma digital de portafolio comercial y recomendación para
microcomercios locales — caso de estudio: barberías del barrio Britalia,
localidad de Kennedy, Bogotá D.C. Trabajo de grado, Ingeniería de Sistemas y
Computación, Universidad Católica de Colombia.

> **Alcance:** este prototipo cubre exclusivamente barberías y estética de
> Britalia, con dos tipos de usuario — **cliente** y **propietario de
> negocio** (sin rol de administrador). Ver el documento de trabajo de grado,
> sección "Alcance y limitaciones", para el detalle completo.

## Stack tecnológico

- **Frontend:** React 18 + [Vite](https://vitejs.dev)
- **Backend como servicio:** [Firebase](https://firebase.google.com) — Authentication, Firestore, Hosting
- **Enrutamiento:** React Router 6
- **Diseño:** ver el canvas de mockups de alta fidelidad (Figma-equivalente) enlazado en el documento del proyecto

Ver `docs/ARQUITECTURA.md` para el detalle de la arquitectura, `docs/MODELO_DATOS.md`
para el modelo de datos y `docs/UML.md` para los diagramas de casos de uso, clases,
secuencia y despliegue (Objetivo específico 2).

## Primeros pasos

### 1. Instalar lo necesario (una sola vez por computador)

| Herramienta | Para qué | Enlace |
|---|---|---|
| **Node.js** (versión 20 o superior) | Ejecutar el proyecto y sus herramientas | https://nodejs.org (elige la versión LTS) |
| **Git** | Control de versiones | https://git-scm.com/downloads |
| **Visual Studio Code** | Editor de código | https://code.visualstudio.com |
| **Cuenta de GitHub** | Alojar el repositorio compartido | https://github.com |
| **Cuenta de Google** | Crear el proyecto de Firebase | https://console.firebase.google.com |

Extensiones recomendadas de VS Code (buscar en la pestaña Extensions, `Ctrl+Shift+X`):
`ES7+ React/Redux/React-Native snippets`, `ESLint`, `Firebase Explorer` (opcional),
`Markdown Preview Mermaid Support` (para ver los diagramas de `docs/` renderizados dentro de VS Code).

Para confirmar que Node y Git quedaron bien instalados, abre una terminal y ejecuta:

```bash
node --version   # debe mostrar v20.x o superior
git --version
```

### 2. Crear el repositorio en GitHub y clonarlo

Uno de los dos integrantes crea el repositorio (el otro se une como colaborador):

1. En GitHub, botón **New repository** → nómbralo `minibarrio-app` → **Private**
   (mientras es trabajo de grado, luego puede hacerse público) → **Create repository**.
2. En **Settings → Collaborators → Add people**, agrega a tu compañero por su usuario
   de GitHub para que también pueda hacer *push*.
3. Cada integrante clona el repositorio en su computador (en VS Code: `Ctrl+Shift+P` →
   "Git: Clone", pega la URL del repo; o desde la terminal):

   ```bash
   git clone https://github.com/<usuario-o-equipo>/minibarrio-app.git
   cd minibarrio-app
   code .
   ```

> Si ya tienes el proyecto en tu máquina (por ejemplo, porque te lo compartieron como
> carpeta) en lugar de clonarlo: crea el repo vacío en GitHub, y desde la carpeta del
> proyecto corre `git init`, `git remote add origin <URL>`, `git add .`,
> `git commit -m "Primer commit: scaffold del proyecto"`, `git push -u origin main`.

### 3. Instalar las dependencias del proyecto

Dentro de la carpeta del proyecto:

```bash
npm install
```

Esto descarga React, Firebase y todo lo que el proyecto necesita a la carpeta
`node_modules/` (que nunca se sube a Git — ya está en `.gitignore`; cada integrante
la genera localmente con este mismo comando).

### 4. Crear el proyecto de Firebase (una sola vez, lo hace un integrante)

1. Entra a https://console.firebase.google.com → **Agregar proyecto** → nómbralo
   `minibarrio` (o el nombre que prefieran) → puedes desactivar Google Analytics,
   no se usa en este prototipo.
2. Dentro del proyecto, ve a **Compilación → Authentication → Comenzar** → pestaña
   **Sign-in method** → habilita **Correo electrónico/contraseña**.
3. Ve a **Compilación → Firestore Database → Crear base de datos** → modo
   **producción** (las reglas de seguridad ya están escritas en `firestore.rules`) →
   elige una región cercana (`southamerica-east1` — São Paulo, la más cercana a Colombia).
4. Ve a **Compilación → Hosting → Comenzar** (lo necesitarán más adelante para
   desplegar, actividad 3.8 del cronograma; por ahora con seguir el asistente basta).
5. Ve a **Configuración del proyecto (⚙️) → Tus apps → Agregar app → Web (`</>`)** →
   nómbrala `minibarrio-web` → copia el objeto `firebaseConfig` que te muestra.
6. **Comparte esas credenciales con tu compañero de equipo** (por WhatsApp, un
   gestor de contraseñas compartido, etc. — **nunca las subas a GitHub**).

### 5. Configurar las variables de entorno (cada integrante, en su propio computador)

```bash
cp .env.example .env
```

Abre el archivo `.env` recién creado y pega los valores del `firebaseConfig` del
paso anterior:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=minibarrio-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=minibarrio-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=minibarrio-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

`.env` está en `.gitignore` — cada integrante lo crea una vez en su máquina y no se
vuelve a tocar ni a compartir por Git.

### 6. Correr el proyecto

```bash
npm run dev
```

Abre automáticamente `http://localhost:5173`. Deberías ver la pantalla de login de
MiniBarrio. Prueba registrar una cuenta de cliente y una de propietario para
confirmar que todo quedó bien conectado a Firebase (revisa en Firebase Console →
Authentication y → Firestore Database que aparezcan los registros nuevos).

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo con recarga en caliente |
| `npm run build` | Genera el build de producción en `dist/` |
| `npm run preview` | Sirve localmente el build de `dist/` para probarlo antes de desplegar |
| `npm run lint` | Revisa el código con ESLint |

## Flujo de trabajo en equipo (Git)

Para evitar pisarse el trabajo entre los dos integrantes:

1. **Nunca trabajen directo sobre `main`.** Antes de empezar algo nuevo:
   ```bash
   git checkout main
   git pull
   git checkout -b feature/nombre-corto   # ej: feature/busqueda-negocios
   ```
2. Hagan commits pequeños y descriptivos mientras avanzan:
   ```bash
   git add .
   git commit -m "Agrega formulario de registro de cliente"
   ```
3. Suban la rama y abran un Pull Request en GitHub para que el otro revise antes
   de fusionar a `main`:
   ```bash
   git push -u origin feature/nombre-corto
   ```
4. Ya fusionado, borren la rama y vuelvan a `main` actualizado antes del siguiente feature.

Esto también deja un historial de commits claro y trazable, útil para el
"Repositorio de código fuente" que exige el documento de trabajo de grado
(sección 1.9, Productos a entregar) y para dividir el trabajo por Sprint tal
como está repartido en el cronograma (`Cronograma_Trabajo_Grado.xlsx`).

## Estado actual del prototipo

Lo que ya está implementado (arranque de Fase 3, Sprint 1 — autenticación):

- [x] Registro de cliente (RF-01) con creación de perfil en Firestore
- [x] Registro de propietario de negocio (RF-01, RF-02) con creación del negocio
- [x] Login con enrutamiento automático según el rol real guardado en Firestore
- [x] Rutas protegidas por rol (`/` solo cliente, `/panel` solo propietario)
- [x] Reglas de seguridad de Firestore por rol (`firestore.rules`)

Lo que sigue (ver `docs/ARQUITECTURA.md` y el cronograma para el detalle de cada sprint):

- [ ] CRUD de portafolio de servicios (RF-03, RF-04) — `src/pages/owner/`
- [ ] Búsqueda y listado de negocios con filtros (RF-05, RF-06) — `src/pages/client/`
- [ ] Motor de recomendaciones (RF-09)
- [ ] Agendamiento de citas (RF-07, RF-08)
- [ ] Reseñas y calificaciones (RF-10)
- [ ] Canales de contacto directo integrados (RF-11)
- [ ] Despliegue en Firebase Hosting (actividad 3.8)

La interfaz definitiva de cada una de estas pantallas ya está diseñada y
validada en el canvas de mockups de alta fidelidad — la implementación debe
seguir ese diseño (colores, tipografía y componentes en `src/index.css`).

## Licencia

Uso académico — Universidad Católica de Colombia.
