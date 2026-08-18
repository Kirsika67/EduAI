import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import Card from '../components/Card'

/**
 * Vanema ja õpilase maandumisleht. Täisvaade (jutustav kokkuvõte, kaardid, "küsi midagi")
 * valmib Faasis 7 — seni näidatakse ainult seda, mis on päriselt olemas ja kinnitatud.
 * Pigem aus tühjus kui tühjade kastide teater.
 */
export default function MyChildPage() {
  const { teacher, role, school } = useAuth()
  const isStudent = role === ROLES.STUDENT
  const children = teacher?.children || []

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {isStudent ? 'Minu profiil' : 'Minu laps'}
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {school?.name || 'Kool'} · {teacher?.roleLabel}
      </p>

      {!children.length && (
        <Card>
          <p className="text-sm text-gray-500">
            Sinu kontot pole veel ühegi õpilasega seotud. Võta ühendust klassijuhatajaga.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {children.map(child => (
          <Card key={child.id}>
            <p className="text-[13px] font-bold text-gray-900">{child.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{child.className}</p>
          </Card>
        ))}
      </div>

      <div className="bg-[#E5F5F3] rounded-xl p-5 mt-6">
        <p className="text-sm font-semibold text-[#1B6156] mb-1">Mis siia tuleb</p>
        <p className="text-[13px] text-[#1B6156]/90 leading-relaxed">
          {isStudent
            ? 'Sinu tulemused, kohalolek, eesmärgid ja õpiabiline. Sina näed oma tulemusi sama hetkel või varem kui sinu vanem — mitte hiljem.'
            : 'Jutustav kokkuvõte „kuidas lapsel läheb“, kohalolek, viimased hinded, tähtajad ja otsesuhtlus õpetajaga.'}
        </p>
        <p className="text-[11px] text-[#1B6156]/70 mt-2">
          Kuni siis ei kuvata siin toorandmeid — ligipääs on olemas, sisu tuleb Faasis 7.
        </p>
      </div>
    </div>
  )
}
