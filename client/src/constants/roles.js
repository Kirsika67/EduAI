/**
 * Peegeldab server/src/constants/roles.js — kui üht muudad, muuda ka teist.
 * Frontend peidab ainult UI-d; päris keeld on alati backendis (RULE R1).
 */
export const ROLES = {
  TEACHER: 'teacher',
  HOMEROOM_TEACHER: 'homeroom_teacher',
  SUPPORT_SPECIALIST: 'support_specialist',
  HEADTEACHER: 'headteacher',
  PRINCIPAL: 'principal',
  PARENT: 'parent',
  STUDENT: 'student',
}

export const ROLE_LABELS = {
  [ROLES.TEACHER]: 'Aineõpetaja',
  [ROLES.HOMEROOM_TEACHER]: 'Klassijuhataja',
  [ROLES.SUPPORT_SPECIALIST]: 'Tugispetsialist',
  [ROLES.HEADTEACHER]: 'Õppealajuhataja',
  [ROLES.PRINCIPAL]: 'Direktor',
  [ROLES.PARENT]: 'Lapsevanem',
  [ROLES.STUDENT]: 'Õpilane',
}

/** Rollid, mida saab registreerimisel ise valida. */
export const SELF_REGISTER_ROLES = [
  ROLES.TEACHER,
  ROLES.HOMEROOM_TEACHER,
  ROLES.SUPPORT_SPECIALIST,
  ROLES.HEADTEACHER,
  ROLES.PRINCIPAL,
]

export const STAFF_ROLES = SELF_REGISTER_ROLES
export const LEADERSHIP_ROLES = [ROLES.HEADTEACHER, ROLES.PRINCIPAL]
export const CAN_INVITE_ROLES = [ROLES.HOMEROOM_TEACHER, ROLES.HEADTEACHER, ROLES.PRINCIPAL]

export const isStaff = role => STAFF_ROLES.includes(role)
export const isLeadership = role => LEADERSHIP_ROLES.includes(role)
export const canInvite = role => CAN_INVITE_ROLES.includes(role)
export const roleLabel = role => ROLE_LABELS[role] || role

/**
 * Navigatsioon rolli järgi. `soon: true` tähendab, et leht valmib hilisemas faasis —
 * seda kuvatakse hallilt ja mitteklõpsatavana, et kasutaja ei satuks tühjale lehele.
 */
const STAFF_NAV = [
  { to: '/ulevaade', label: 'Ülevaade' },
  { to: '/tunniplaan', label: 'Tunniplaan' },
  { to: '/opilased', label: 'Õpilased' },
  { to: '/hinded', label: 'Hinded' },
  { to: '/klassid', label: 'Klassid' },
  { to: '/materjalid', label: 'Materjalid' },
  { to: '/tagasiside', label: 'Tagasiside' },
  { to: '/planeerimine', label: 'Planeerimine' },
  { to: '/kohalolek', label: 'Kohalolek' },
  { to: '/sonumid', label: 'Sõnumid' },
]

const PARENT_NAV = [
  { to: '/minu-laps', label: 'Minu laps' },
  { to: '/tunniplaan', label: 'Tunniplaan' },
  { to: '/tunniplaan/vanemapaev', label: 'Vanemate päev' },
  { to: '/sonumid', label: 'Sõnumid' },
  { to: '/huviringid', label: 'Huviringid' },
]

const STUDENT_NAV = [
  { to: '/minu-laps', label: 'Minu profiil' },
  { to: '/tunniplaan', label: 'Tunniplaan' },
  { to: '/huviringid', label: 'Huviringid' },
  { to: '/sonumid', label: 'Sõnumid' },
]

/** Juhtkond näeb sama menüüd + kogu kooli vaadet kohe Ülevaate järel. */
const LEADERSHIP_NAV = [
  STAFF_NAV[0],
  { to: '/kool', label: 'Kool' },
  ...STAFF_NAV.slice(1),
]

export function navForRole(role) {
  if (role === ROLES.PARENT) return PARENT_NAV
  if (role === ROLES.STUDENT) return STUDENT_NAV
  if (isLeadership(role)) return LEADERSHIP_NAV
  return STAFF_NAV
}

/** Kuhu kasutaja pärast sisselogimist maandub. */
export function landingPathForRole(role) {
  if (role === ROLES.PARENT || role === ROLES.STUDENT) return '/minu-laps'
  return '/ulevaade'
}
