// Campos de teléfono / WhatsApp al registrarse: solo se aceptan números
// (cualquier letra, espacio o símbolo que se escriba o pegue se descarta).
export function soloDigitos(valor) {
  return valor.replace(/\D/g, '')
}
