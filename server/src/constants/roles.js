/**
 * Kasutajarollid. Kontode tabel on ajaloolistel põhjustel `teachers`, aga seal elavad
 * kõik rollid — ka vanem ja õpilane (vt docs/ARHITEKTUUR_JA_PLAAN.md, K1).
 *
 * SQLite ei luba ALTER TABLE ADD COLUMN juures usaldusväärset CHECK-piirangut, seega on
 * see fail ainus tõe allikas: iga rolli kirjutav tee peab valideerima siinse nimekirja
 * vastu (`STAFF_ROLES` registreerimisel, `INVITE_ONLY_ROLES` kutsetel).
 */
export const ROLES = {
  TEACHER: "teacher",
  HOMEROOM_TEACHER: "homeroom_teacher",
  SUPPORT_SPECIALIST: "support_specialist",
  HEADTEACHER: "headteacher",
  PRINCIPAL: "principal",
  PARENT: "parent",
  STUDENT: "student",
};

export const ALL_ROLES = Object.values(ROLES);

/** Koolitöötajad — need rollid saavad end ise registreerida. */
export const STAFF_ROLES = [
  ROLES.TEACHER,
  ROLES.HOMEROOM_TEACHER,
  ROLES.SUPPORT_SPECIALIST,
  ROLES.HEADTEACHER,
  ROLES.PRINCIPAL,
];

/** Juhtkond — näeb kogu kooli (Faas 6). */
export const LEADERSHIP_ROLES = [ROLES.HEADTEACHER, ROLES.PRINCIPAL];

/** Näeb kogu kooli õpilaste riskitasemeid, aga mitte kõiki eraviisilisi märkmeid. */
export const SCHOOL_WIDE_ROLES = [
  ROLES.SUPPORT_SPECIALIST,
  ROLES.HEADTEACHER,
  ROLES.PRINCIPAL,
];

/** Ainult kutse kaudu — mitte kunagi avalikust registreerimisest. */
export const INVITE_ONLY_ROLES = [ROLES.PARENT, ROLES.STUDENT];

/** Kes tohib kutseid saata. */
export const CAN_INVITE_ROLES = [
  ROLES.HOMEROOM_TEACHER,
  ROLES.HEADTEACHER,
  ROLES.PRINCIPAL,
];

export const ROLE_LABELS = {
  [ROLES.TEACHER]: "Aineõpetaja",
  [ROLES.HOMEROOM_TEACHER]: "Klassijuhataja",
  [ROLES.SUPPORT_SPECIALIST]: "Tugispetsialist",
  [ROLES.HEADTEACHER]: "Õppealajuhataja",
  [ROLES.PRINCIPAL]: "Direktor",
  [ROLES.PARENT]: "Lapsevanem",
  [ROLES.STUDENT]: "Õpilane",
};

export function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

export function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

export function isLeadership(role) {
  return LEADERSHIP_ROLES.includes(role);
}

export function seesWholeSchool(role) {
  return SCHOOL_WIDE_ROLES.includes(role);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
