import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Hash ficticio (costo 12) para igualar el tiempo de respuesta cuando el usuario no existe
// y así evitar la enumeración de cuentas por tiempos de respuesta.
export const DUMMY_HASH = bcrypt.hashSync("lucia-jeans-dummy-password", COST);
