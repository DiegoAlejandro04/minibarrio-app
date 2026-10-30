import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { leerPerfilCliente } from '../../perfilesClientes.js'
import Icon from '../../components/Icon.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'
import { precioDeCita } from '../../adicionales.js'

// Panel del comerciante — vista "Resumen" (RF-02, RF-07). Conectado a datos
// reales del negocio vía onSnapshot (tiempo real).

const ESTADO_STYLES = {
  confirmada: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Confirmada' },
  pendiente: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Reservada' },
  'en-proceso': { bg: 'oklch(60% 0.13 250 / 0.16)', text: 'oklch(55% 0.14 250)', label: 'En proceso' },
  cancelada: { bg: 'oklch(93% 0.035 25)', text: 'var(--danger)', label: 'Cancelada' },
  completada: { bg: 'var(--surface-2)', text: 'var(--text-muted)', label: 'Completada' },
}

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function startOfWeek(date) {
  const d = new Date(date)
  const dia = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const TITULOS_GRAFICA = { visitas: 'Visitas al portafolio', citas: 'Citas agendadas', ingresos: 'Ingresos generados' }

// Marcas del eje de la gráfica de ingresos: "$50 mil", "$1,2 M".
function pesosCortos(v) {
  if (v >= 1000000) return `$${(v / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (v >= 1000) return `$${Math.round(v / 1000)} mil`
  return `$${v}`
}

export default function OwnerResumen() {
  const { negocio, servicios, uid } = useOutletContext()
  const isMobile = useIsMobile()

  const [citas, setCitas] = useState([])
  const [resenas, setResenas] = useState([])
  const [visitas, setVisitas] = useState([]) // fechas (Date) de cada visita registrada
  // Servicios registrados a mano en "Caja" (OwnerCaja.jsx): cuentan como
  // citas y suman lo que se cobró a los ingresos.
  const [atenciones, setAtenciones] = useState([])
  const [clientes, setClientes] = useState({}) // uid -> nombre
  const [modoCitas, setModoCitas] = useState('semanal') // 'semanal' | 'mensual'
  const [modoIngresos, setModoIngresos] = useState('semanal') // 'semanal' | 'mensual' | 'semestre'
  const [semestre, setSemestre] = useState('primero') // 'primero' | 'segundo'
  const [modoVisitas, setModoVisitas] = useState('semanal') // 'semanal' | 'mensual'
  const [graficaDe, setGraficaDe] = useState('visitas') // 'visitas' | 'citas' | 'ingresos'

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(collection(db, 'negocios', uid, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'negocios', uid, 'visitas'), (snap) => {
        setVisitas(snap.docs.map((d) => d.data().visitadoEn?.toDate?.()).filter(Boolean))
      }),
      onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', uid)), (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'negocios', uid, 'atenciones'), (snap) => {
        setAtenciones(snap.docs
          .map((d) => {
            const datos = d.data({ serverTimestamps: 'estimate' })
            return { servicioId: datos.servicioId, cobrado: datos.cobrado || 0, fecha: datos.creadoEn?.toDate?.() }
          })
          .filter((a) => a.fecha))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Resuelve el nombre de cada cliente que aparece en las citas (join simple
  // contra "usuarios", ya que "citas" solo guarda clienteId por diseño).
  useEffect(() => {
    const faltantes = [...new Set(citas.map((c) => c.clienteId))].filter((id) => id && !(id in clientes))
    if (faltantes.length === 0) return
    faltantes.forEach(async (clienteId) => {
      const cita = citas.find((c) => c.clienteId === clienteId)
      const perfil = await leerPerfilCliente(uid, clienteId, { citaId: cita.id })
      setClientes((prev) => ({ ...prev, [clienteId]: perfil?.nombre || 'Cliente' }))
    })
  }, [citas, clientes, uid])

  const ahora = useMemo(() => new Date(), [])
  const inicioSemana = useMemo(() => startOfWeek(ahora), [ahora])
  const finSemana = useMemo(() => {
    const d = new Date(inicioSemana)
    d.setDate(d.getDate() + 7)
    return d
  }, [inicioSemana])

  const citasConFecha = useMemo(
    () => citas.map((c) => ({ ...c, fecha: c.fechaHora?.toDate ? c.fechaHora.toDate() : null })),
    [citas]
  )

  const citasHoy = useMemo(
    () => citasConFecha.filter((c) => c.fecha && isSameDay(c.fecha, ahora)).sort((a, b) => a.fecha - b.fecha),
    [citasConFecha, ahora]
  )

  // Semana de lunes a domingo (con límite superior, no solo "desde el lunes").
  const atencionesSemana = useMemo(
    () => atenciones.filter((a) => a.fecha >= inicioSemana && a.fecha < finSemana),
    [atenciones, inicioSemana, finSemana]
  )
  const atencionesMes = useMemo(() => atenciones.filter((a) => isSameMonth(a.fecha, ahora)), [atenciones, ahora])

  const citasEstaSemana = useMemo(
    () => citasConFecha.filter((c) => c.fecha && c.fecha >= inicioSemana && c.fecha < finSemana).length + atencionesSemana.length,
    [citasConFecha, inicioSemana, finSemana, atencionesSemana]
  )

  const citasEsteMes = useMemo(
    () => citasConFecha.filter((c) => c.fecha && isSameMonth(c.fecha, ahora)).length + atencionesMes.length,
    [citasConFecha, ahora, atencionesMes]
  )

  const citasMostradas = modoCitas === 'semanal' ? citasEstaSemana : citasEsteMes
  const enCajaMostradas = modoCitas === 'semanal' ? atencionesSemana.length : atencionesMes.length

  const serviciosPorId = useMemo(() => Object.fromEntries(servicios.map((s) => [s.id, s])), [servicios])

  // Ingresos: suma citas reservadas, en proceso o realizadas (las canceladas no cuentan).
  const cuentaParaIngresos = (c) => c.estado === 'pendiente' || c.estado === 'en-proceso' || c.estado === 'completada'

  // Cada ingreso con su fecha: las citas que cuentan (con los servicios
  // sumados, ver adicionales.js) y lo cobrado en Caja. De aquí salen la
  // tarjeta, la comparación con el periodo anterior y la gráfica de
  // ingresos, así que las tres siempre cuadran.
  const ingresosConFecha = useMemo(
    () => [
      ...citasConFecha
        .filter((c) => c.fecha && cuentaParaIngresos(c))
        .map((c) => ({ fecha: c.fecha, valor: precioDeCita(c, serviciosPorId[c.servicioId]) })),
      ...atenciones.map((a) => ({ fecha: a.fecha, valor: a.cobrado })),
    ],
    [citasConFecha, serviciosPorId, atenciones]
  )
  const ingresosEntre = (desde, hasta) => ingresosConFecha
    .filter((i) => i.fecha >= desde && i.fecha < hasta)
    .reduce((sum, i) => sum + i.valor, 0)

  // Periodo que muestra la tarjeta y el anterior, para comparar: la semana
  // pasada, el mes pasado o el semestre anterior.
  const { actual: periodoActual, anterior: periodoAnterior, nombreAnterior } = useMemo(() => {
    if (modoIngresos === 'semanal') {
      const antes = new Date(inicioSemana)
      antes.setDate(antes.getDate() - 7)
      return { actual: [inicioSemana, finSemana], anterior: [antes, inicioSemana], nombreAnterior: 'la semana pasada' }
    }
    if (modoIngresos === 'mensual') {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return {
        actual: [inicio, new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)],
        anterior: [new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1), inicio],
        nombreAnterior: 'el mes pasado',
      }
    }
    const anio = ahora.getFullYear()
    const mesInicio = semestre === 'primero' ? 0 : 6
    const inicio = new Date(anio, mesInicio, 1)
    return {
      actual: [inicio, new Date(anio, mesInicio + 6, 1)],
      anterior: [new Date(anio, mesInicio - 6, 1), inicio],
      nombreAnterior: 'el semestre anterior',
    }
  }, [modoIngresos, semestre, ahora, inicioSemana, finSemana])

  const ingresosMostrados = ingresosEntre(...periodoActual)
  const ingresosAnteriores = ingresosEntre(...periodoAnterior)
  // Variación en %, solo si el periodo anterior tuvo ingresos (contra cero no
  // hay porcentaje que valga).
  const variacionIngresos = ingresosAnteriores > 0
    ? Math.round(((ingresosMostrados - ingresosAnteriores) / ingresosAnteriores) * 100)
    : null

  const subIngresos = modoIngresos === 'semanal'
    ? 'Semana en curso'
    : modoIngresos === 'mensual'
      ? 'Mes en curso'
      : semestre === 'primero'
        ? 'Ingresos desde enero a junio'
        : 'Ingresos desde julio a diciembre'

  const calificacionPromedio = useMemo(() => {
    if (resenas.length === 0) return null
    return resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length
  }, [resenas])

  const resenasNuevas = useMemo(
    () => resenas.filter((r) => r.creadoEn?.toDate && r.creadoEn.toDate() >= inicioSemana).length,
    [resenas, inicioSemana]
  )

  const reservasPorServicio = useMemo(() => {
    const conteo = {}
    citasConFecha.forEach((c) => {
      if (c.fecha && isSameMonth(c.fecha, ahora) && c.servicioId) {
        conteo[c.servicioId] = (conteo[c.servicioId] || 0) + 1
      }
    })
    atencionesMes.forEach((a) => {
      if (a.servicioId) conteo[a.servicioId] = (conteo[a.servicioId] || 0) + 1
    })
    return conteo
  }, [citasConFecha, ahora, atencionesMes])

  // Series de la gráfica: por día de esta semana o por mes de este año. Cada
  // elemento es { fecha, valor }: 1 por visita o cita, o el dinero de cada
  // ingreso.
  const porDiaDeLaSemana = (items) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label, i) => {
    const dia = new Date(inicioSemana)
    dia.setDate(dia.getDate() + i)
    return { label, value: items.filter((it) => isSameDay(it.fecha, dia)).reduce((s, it) => s + it.valor, 0) }
  })
  const porMesDelAnio = (items) => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((label, i) => ({
    label,
    value: items
      .filter((it) => it.fecha.getFullYear() === ahora.getFullYear() && it.fecha.getMonth() === i)
      .reduce((s, it) => s + it.valor, 0),
  }))

  // Citas agendadas para la gráfica: las mismas que cuenta la tarjeta de
  // arriba (citas de la app más las registradas en Caja), por su fecha.
  const fechasCitas = useMemo(
    () => [...citasConFecha.filter((c) => c.fecha).map((c) => c.fecha), ...atenciones.map((a) => a.fecha)],
    [citasConFecha, atenciones]
  )

  const itemsGrafica = graficaDe === 'ingresos'
    ? ingresosConFecha
    : (graficaDe === 'visitas' ? visitas : fechasCitas).map((fecha) => ({ fecha, valor: 1 }))
  const fechasGrafica = itemsGrafica
  const serieGrafica = modoVisitas === 'semanal' ? porDiaDeLaSemana(itemsGrafica) : porMesDelAnio(itemsGrafica)

  const fechaLarga = capitalize(FECHA_LARGA.format(ahora))

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Hola, {negocio.nombre}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            {fechaLarga} ·{' '}
            {citasHoy.length === 0
              ? 'sin citas programadas para hoy'
              : `${citasHoy.length} cita${citasHoy.length === 1 ? '' : 's'} programada${citasHoy.length === 1 ? '' : 's'} para hoy`}
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? 12 : 16 }}>
        <StatTile
          icon="eye"
          label="Visitas al perfil"
          value={visitas.length.toLocaleString('es-CO')}
          sub={visitas.length === 0 ? 'Aún sin visitas' : 'Clientes únicos que vieron tu perfil'}
        />
        <StatTile
          icon="calendar"
          label="Citas agendadas"
          value={citasMostradas.toLocaleString('es-CO')}
          sub={`${citasMostradas} ${modoCitas === 'semanal' ? 'esta semana' : 'este mes'}${enCajaMostradas > 0 ? ` · ${enCajaMostradas} desde Caja` : ''}`}
          extra={
            <ToggleSegmentado
              opciones={[{ value: 'semanal', label: 'Semanal' }, { value: 'mensual', label: 'Mensual' }]}
              valor={modoCitas}
              onChange={setModoCitas}
              width={124}
            />
          }
        />
        <StatTile
          icon="star"
          label="Calificación"
          value={calificacionPromedio === null ? '—' : calificacionPromedio.toFixed(1)}
          sub={resenas.length === 0 ? 'Sin reseñas aún' : `${resenasNuevas} reseña${resenasNuevas === 1 ? '' : 's'} nueva${resenasNuevas === 1 ? '' : 's'}`}
        />

        <div className="card" style={{ padding: '16px 18px', gridColumn: isMobile ? '1 / -1' : undefined }}>
          {/* Título e ícono arriba; el selector en su propia línea (al lado
              del título no cabía y empujaba el ícono fuera de la tarjeta). */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 700 }}>Ingresos estimados</div>
            <div style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
              <Icon name="trending" size={16} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <ToggleSegmentado
              opciones={[
                { value: 'semanal', label: 'Semanal' },
                { value: 'mensual', label: 'Mensual' },
                { value: 'semestre', label: 'Semestre' },
              ]}
              valor={modoIngresos}
              onChange={setModoIngresos}
              width={172}
            />
          </div>

          {modoIngresos === 'semestre' && (
            <div style={{ marginTop: 6 }}>
              <ToggleSegmentado
                opciones={[
                  { value: 'primero', label: '1er Semestre' },
                  { value: 'segundo', label: '2do Semestre' },
                ]}
                valor={semestre}
                onChange={setSemestre}
                width={196}
                fontSize={9.5}
              />
            </div>
          )}

          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>{COP.format(ingresosMostrados)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>{subIngresos}</div>
          {variacionIngresos !== null && (
            <div
              className={`variacion-ingresos ${variacionIngresos > 0 ? 'sube' : variacionIngresos < 0 ? 'baja' : 'igual'}`}
              title={`${nombreAnterior}: ${COP.format(ingresosAnteriores)}`}
            >
              {variacionIngresos > 0 ? '↑' : variacionIngresos < 0 ? '↓' : '='} {Math.abs(variacionIngresos)} % vs. {nombreAnterior}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {TITULOS_GRAFICA[graficaDe]}
              </div>
              <div style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 2 }}>
                {fechasGrafica.length === 0
                  ? (graficaDe === 'visitas' ? 'Aún no hay datos de tráfico para mostrar.' : graficaDe === 'citas' ? 'Aún no hay citas para mostrar.' : 'Aún no hay ingresos para mostrar.')
                  : modoVisitas === 'semanal'
                    ? 'Esta semana, por día'
                    : `Este año (${ahora.getFullYear()}), por mes`}
              </div>
            </div>
            {/* Qué se grafica (visitas o citas) y en qué periodo. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, width: 210, maxWidth: '100%' }}>
              <ToggleSegmentado
                opciones={[{ value: 'visitas', label: 'Visitas' }, { value: 'citas', label: 'Citas' }, { value: 'ingresos', label: 'Ingresos' }]}
                valor={graficaDe}
                onChange={setGraficaDe}
                width={210}
              />
              <ToggleSegmentado
                opciones={[{ value: 'semanal', label: 'Semanal' }, { value: 'mensual', label: 'Mensual' }]}
                valor={modoVisitas}
                onChange={setModoVisitas}
                width={124}
              />
            </div>
          </div>

          {fechasGrafica.length === 0 ? (
            <div
              style={{
                marginTop: 20, height: 140, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 20px',
              }}
            >
              {graficaDe === 'visitas'
                ? 'Comparte tu perfil para empezar a recibir visitas'
                : graficaDe === 'citas'
                  ? 'Cuando tus clientes reserven, o registres servicios en Caja, verás aquí tus citas'
                  : 'Cuando tengas citas o cobros en Caja, verás aquí cuánto generas'}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <GraficaLineas
                datos={serieGrafica}
                unidad={graficaDe === 'visitas' ? ['visita', 'visitas'] : ['cita', 'citas']}
                // Ingresos: el valor en pesos y el eje abreviado ($50 mil).
                formato={graficaDe === 'ingresos' ? (v) => COP.format(v) : undefined}
                formatoEje={graficaDe === 'ingresos' ? pesosCortos : undefined}
              />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Citas de hoy</div>
          {citasHoy.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No tienes citas programadas para hoy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {citasHoy.map((c) => {
                const estilo = ESTADO_STYLES[c.estado] || ESTADO_STYLES.pendiente
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', width: 64, flexShrink: 0 }}>
                        {HORA.format(c.fecha)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{clientes[c.clienteId] || 'Cliente'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{serviciosPorId[c.servicioId]?.nombre || 'Servicio'}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                        background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap',
                      }}
                    >
                      {estilo.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Servicios publicados</div>
        {servicios.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            Aún no has publicado servicios. Agrégalos desde &ldquo;Servicios&rdquo; en el menú.
          </p>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servicios.map((s) => (
              <div key={s.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.nombre}</div>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, flexShrink: 0,
                      background: s.visible ? 'var(--sage-soft)' : 'var(--surface-2)',
                      color: s.visible ? 'var(--sage-text)' : 'var(--text-faint)',
                    }}
                  >
                    {s.visible ? 'Visible' : 'Oculto'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, fontSize: 12.5 }}>
                  <Campo label="Duración" value={`${s.duracionMinutos} min`} />
                  <Campo label="Precio" value={COP.format(s.precio || 0)} />
                  <Campo label="Reservas (mes)" value={reservasPorServicio[s.id] || 0} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-faint)', fontSize: 11.5, textTransform: 'uppercase' }}>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Servicio</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Duración</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Precio</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Reservas (mes)</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 0', fontWeight: 700 }}>{s.nombre}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.duracionMinutos} min</td>
                    <td style={{ color: 'var(--text-muted)' }}>{COP.format(s.precio || 0)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{reservasPorServicio[s.id] || 0}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                          background: s.visible ? 'var(--sage-soft)' : 'var(--surface-2)',
                          color: s.visible ? 'var(--sage-text)' : 'var(--text-faint)',
                        }}
                      >
                        {s.visible ? 'Visible' : 'Oculto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, value }) {
  return (
    <div>
      <div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function StatTile({ icon, label, value, sub, extra }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      {/* Título e ícono en la primera fila; el selector (extra) debajo, para
          que en las tarjetas angostas del celular nada se salga. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 700, minWidth: 0 }}>{label}</div>
        <div style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      {extra && <div style={{ marginTop: 10 }}>{extra}</div>}
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// Redondea el techo del eje Y a un número "limpio" (4, luego 1/2/5 × 10^n).
function niceMax(valor) {
  if (valor <= 4) return 4
  const magnitud = 10 ** Math.floor(Math.log10(valor))
  const normalizado = valor / magnitud
  const niceNorm = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10
  return niceNorm * magnitud
}

// Gráfica de líneas de una sola serie (sin leyenda: el título de la tarjeta
// ya dice qué se grafica) con crosshair + tooltip al pasar el mouse, ejes
// con valores redondos y la etiqueta del último punto.
// `formato` cambia cómo se muestra un valor (tooltip y último punto) y
// `formatoEje`, las marcas del eje Y; por defecto, números y "N visitas".
function GraficaLineas({ datos, unidad = ['visita', 'visitas'], formato, formatoEje }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const width = 600
  const height = 180
  const padL = 28
  const padR = 12
  const padT = 18
  const padB = 22
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const maxEje = niceMax(Math.max(1, ...datos.map((d) => d.value)))
  const pasos = 4
  const ticks = Array.from({ length: pasos + 1 }, (_, i) => Math.round((maxEje / pasos) * i))

  const x = (i) => padL + (datos.length === 1 ? innerW / 2 : (innerW * i) / (datos.length - 1))
  const y = (v) => padT + innerH - (v / maxEje) * innerH
  const puntos = datos.map((d, i) => [x(i), y(d.value)])
  const pathD = puntos.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px} ${py}`).join(' ')

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * width
    let nearest = 0
    let distMin = Infinity
    puntos.forEach(([px], i) => {
      const dist = Math.abs(px - relX)
      if (dist < distMin) { distMin = dist; nearest = i }
    })
    setHoverIndex(nearest)
  }

  const activo = hoverIndex != null ? datos[hoverIndex] : null
  const ultimo = datos[datos.length - 1]

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height, display: 'block', touchAction: 'none' }}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={9.5} fill="var(--text-faint)">
              {formatoEje ? formatoEje(t) : t}
            </text>
          </g>
        ))}

        {hoverIndex != null && (
          <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={padT} y2={padT + innerH} stroke="var(--border-strong)" strokeWidth={1} />
        )}

        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {puntos.map(([px, py], i) => (
          (i === datos.length - 1 || hoverIndex === i) && (
            <circle key={i} cx={px} cy={py} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          )
        ))}

        {datos.map((d, i) => (
          <text key={d.label} x={x(i)} y={height - 4} textAnchor="middle" fontSize={9.5} fill="var(--text-faint)">
            {d.label}
          </text>
        ))}

        <text x={x(datos.length - 1)} y={y(ultimo.value) - 10} textAnchor="end" fontSize={11} fontWeight={800} fill="var(--text)">
          {formato ? formato(ultimo.value) : ultimo.value}
        </text>
      </svg>

      {activo && (
        <div
          style={{
            position: 'absolute', top: 2,
            left: `${(x(hoverIndex) / width) * 100}%`,
            transform: hoverIndex > (datos.length - 1) / 2 ? 'translateX(-100%)' : 'none',
            background: 'var(--ink)', color: 'var(--ink-text)', fontSize: 11.5, padding: '6px 10px',
            borderRadius: 8, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ fontWeight: 800 }}>{formato ? formato(activo.value) : `${activo.value} ${activo.value === 1 ? unidad[0] : unidad[1]}`}</div>
          <div style={{ opacity: 0.75, fontSize: 10.5 }}>{activo.label}</div>
        </div>
      )}
    </div>
  )
}

// Interruptor estilo iOS (segmented control de N opciones) — usado para
// alternar Semanal/Mensual (Citas y la gráfica), Visitas/Citas agendadas (qué
// muestra la gráfica) y
// Semanal/Mensual/Semestre + 1er/2do semestre (Ingresos estimados).
function ToggleSegmentado({ opciones, valor, onChange, width = 124, fontSize = 10 }) {
  const indice = Math.max(0, opciones.findIndex((o) => o.value === valor))
  const n = opciones.length
  return (
    <div
      style={{
        // Hasta `width`, pero nunca más ancho que su tarjeta (en el celular
        // las tarjetas son angostas y el selector se salía por la derecha).
        position: 'relative', display: 'flex', width: '100%', maxWidth: width, height: 22, borderRadius: 999,
        background: 'var(--surface-2)', padding: 2, flexShrink: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 2, bottom: 2, borderRadius: 999, background: 'var(--accent)',
          transition: 'left 0.18s ease', left: `calc(${indice} * (100% / ${n}) + 2px)`, width: `calc(100% / ${n} - 4px)`,
        }}
      />
      {opciones.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            position: 'relative', flex: 1, border: 'none', background: 'transparent', borderRadius: 999,
            fontSize, fontWeight: 700, cursor: 'pointer', zIndex: 1, padding: 0,
            color: valor === o.value ? '#fff' : 'var(--text-faint)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
