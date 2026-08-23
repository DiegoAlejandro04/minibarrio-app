# Diagramas UML — MiniBarrio (Objetivo específico 2)

Corresponde a las actividades 2.2 y 2.3 del cronograma (diagramas de casos de
uso, clases, secuencia y despliegue). Están en Mermaid para que se rendericen
directamente en GitHub y en VS Code (extensión "Markdown Preview Mermaid
Support") sin depender de ninguna cuenta externa, y sirven como borrador
trazable: para el documento final del trabajo de grado, el plan metodológico
pide herramientas como Lucidchart o Draw.io (actividad 2.2), así que lo más
simple es abrir estos mismos diagramas ahí, redibujarlos con la notación UML
formal (Mermaid aproxima casos de uso y despliegue con notación de flowchart,
no con los símbolos UML estándar) y exportarlos como imagen para pegarlos en
el Word.

## 1. Diagrama de casos de uso

Dos actores (Cliente, Propietario de negocio) — sin actor "Administrador",
según el alcance aprobado. Cada caso de uso referencia su RF.

```mermaid
flowchart LR
    Cliente(["🧑 Cliente"])
    Propietario(["💈 Propietario de negocio"])

    subgraph SYS["MiniBarrio"]
        UC1(["Registrarse / iniciar sesión\n(RF-01)"])
        UC2(["Buscar barberías por servicio,\nubicación y precio (RF-05)"])
        UC3(["Ver barberías en el mapa\n(RF-06)"])
        UC4(["Consultar portafolio completo\nde un negocio (RF-12)"])
        UC5(["Ver disponibilidad en\ntiempo real (RF-07)"])
        UC6(["Agendar una cita (RF-08)"])
        UC7(["Recibir recomendaciones\npersonalizadas (RF-09)"])
        UC8(["Calificar y dejar reseña\n(RF-10)"])
        UC9(["Contactar por WhatsApp,\nllamada o catálogo (RF-11)"])
        UC10(["Registrar datos del negocio\n(RF-02)"])
        UC11(["Crear y editar portafolio\nde servicios (RF-03)"])
        UC12(["Actualizar disponibilidad,\nprecios y servicios (RF-04)"])
    end

    Cliente --> UC1
    Cliente --> UC2
    Cliente --> UC3
    Cliente --> UC4
    Cliente --> UC5
    Cliente --> UC6
    Cliente --> UC7
    Cliente --> UC8
    Cliente --> UC9

    Propietario --> UC1
    Propietario --> UC10
    Propietario --> UC11
    Propietario --> UC12

    UC2 -.incluye.-> UC7
    UC6 -.requiere.-> UC5
```

## 2. Diagrama de clases (dominio)

Clases conceptuales del dominio — no son literalmente clases de JavaScript
(Firestore no obliga a modelar así), pero documentan las entidades y sus
relaciones para el sustento académico del diseño (ver `MODELO_DATOS.md` para
cómo se traduce a colecciones reales).

```mermaid
classDiagram
    class Usuario {
        +String uid
        +String nombre
        +String correo
        +String telefono
        +Rol rol
        +Boolean consentimientoDatos
        +iniciarSesion(correo, contrasena)
        +registrarse(datos)
    }

    class Cliente {
        +buscarNegocios(filtros)
        +agendarCita(negocio, servicio, horario)
        +dejarResena(negocio, calificacion, comentario)
    }

    class Propietario {
        +registrarNegocio(datos)
        +publicarServicio(servicio)
        +actualizarDisponibilidad(servicio)
    }

    class Negocio {
        +String negocioId
        +String propietarioId
        +String nombre
        +String categoria
        +String direccion
        +Map canalesContacto
        +Map horarios
        +Boolean verificado
        +listarServicios()
        +calcularCalificacionPromedio()
    }

    class Servicio {
        +String servicioId
        +String nombre
        +Number precio
        +Number duracionMinutos
        +Boolean visible
    }

    class Cita {
        +String citaId
        +DateTime fechaHora
        +EstadoCita estado
        +confirmar()
        +cancelar()
    }

    class Resena {
        +String resenaId
        +Number calificacion
        +String comentario
    }

    class MotorRecomendacion {
        +generarRecomendaciones(cliente, negocios) List~Negocio~
        -calcularAfinidadContenido(cliente, negocio) Number
        -calcularAfinidadCercania(cliente, negocio) Number
    }

    Usuario <|-- Cliente
    Usuario <|-- Propietario
    Propietario "1" --> "1" Negocio : administra
    Negocio "1" --> "*" Servicio : publica
    Negocio "1" --> "*" Resena : recibe
    Cliente "1" --> "*" Cita : agenda
    Negocio "1" --> "*" Cita : recibe
    Cliente "1" --> "*" Resena : escribe
    MotorRecomendacion ..> Negocio : evalúa
    MotorRecomendacion ..> Cliente : usa preferencias de
```

## 3. Diagrama de secuencia — registro y enrutamiento por rol

Cubre el flujo que se acaba de implementar en el código (`AuthContext.jsx`,
`ProtectedRoute.jsx`): el registro crea el usuario en Firebase Auth y su
perfil con rol en Firestore; el login solo autentica y el rol real se lee
siempre desde Firestore (nunca se confía en lo que el usuario seleccionó
en la pantalla).

```mermaid
sequenceDiagram
    actor U as Propietario
    participant UI as RegisterBusiness.jsx
    participant Ctx as AuthContext
    participant Auth as Firebase Authentication
    participant DB as Firestore

    U->>UI: Completa formulario y envía
    UI->>Ctx: registerBusinessOwner(datos)
    Ctx->>Auth: createUserWithEmailAndPassword()
    Auth-->>Ctx: uid del nuevo usuario
    Ctx->>DB: set(usuarios/{uid}, {rol:"propietario", ...})
    Ctx->>DB: set(negocios/{uid}, {propietarioId:uid, ...})
    DB-->>Ctx: OK
    Ctx-->>UI: usuario creado
    UI->>U: Redirige a /panel

    Note over U,DB: --- Inicio de sesión posterior ---
    U->>UI: Ingresa correo y contraseña en /login
    UI->>Ctx: login(correo, contrasena)
    Ctx->>Auth: signInWithEmailAndPassword()
    Auth-->>Ctx: uid
    Ctx->>DB: get(usuarios/{uid})
    DB-->>Ctx: {rol: "propietario", ...}
    Ctx-->>UI: rol = "propietario"
    UI->>U: Redirige a /panel (ProtectedRoute valida el rol)
```

## 4. Diagrama de despliegue

Arquitectura cliente-servidor con backend como servicio (BaaS), tal como
define la actividad 2.1 del cronograma.

```mermaid
flowchart TB
    subgraph Cliente["Dispositivo del usuario"]
        Browser["Navegador móvil o de escritorio\n(React SPA servida como estáticos)"]
    end

    subgraph Firebase["Firebase (Google Cloud) — BaaS"]
        Hosting["Firebase Hosting\n(HTML/CSS/JS estáticos, CDN)"]
        Auth["Firebase Authentication\n(correo + contraseña)"]
        Firestore[("Cloud Firestore\n(usuarios, negocios, servicios,\ncitas, reseñas)")]
    end

    Browser -- "HTTPS: carga la app" --> Hosting
    Browser -- "HTTPS: login / registro" --> Auth
    Browser -- "HTTPS: lecturas/escrituras\nen tiempo real (SDK)" --> Firestore
    Auth -. "uid autenticado" .-> Firestore
```
