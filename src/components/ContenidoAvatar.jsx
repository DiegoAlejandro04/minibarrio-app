import { inicialesDe } from './FotoNegocio.jsx'

// Lo que va dentro del círculo de una persona: su foto de perfil (la sube el
// cliente en Datos personales, ClientDatosPersonales.jsx) o, sin foto, sus
// iniciales. El círculo (tamaño y color) lo pone quien lo usa; la foto lo
// llena con .avatar-foto (index.css).
export default function ContenidoAvatar({ nombre, foto }) {
  if (foto) return <img src={foto} alt="" className="avatar-foto" />
  return inicialesDe(nombre)
}
