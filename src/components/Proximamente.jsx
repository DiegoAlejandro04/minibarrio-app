export default function Proximamente({ titulo }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{titulo}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
        Esta sección todavía no está disponible — está en el backlog del proyecto.
      </p>
    </div>
  )
}
