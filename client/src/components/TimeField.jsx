import { useState, useEffect } from 'react'

/**
 * Kellaaja väli.
 *
 * Miks mitte `<input type="time">`: natiivne segmentvidin käitub brauseriti
 * erinevalt (Safari vs Chrome), sõltub süsteemi 12/24 tunni seadest ja
 * kontrollitud Reacti väljana jääb mõnes brauseris sisestuse peale kinni.
 * Tavaline tekstiväli käitub kõikjal ühtemoodi ja õpetaja saab lihtsalt
 * kirjutada "15:00" või "1500".
 *
 * Väljapoole antakse alati kas "" või kehtiv "HH:MM".
 */
export default function TimeField({ value, onChange, className = '', placeholder = '15:00', ...rest }) {
  const [raw, setRaw] = useState(value || '')

  /** Väljastpoolt tulnud muutus (nt vormi tühjendamine) jõuab välja. */
  useEffect(() => {
    setRaw(prev => (normalise(prev).value === (value || '') ? prev : value || ''))
  }, [value])

  const handleChange = (text) => {
    setRaw(text)
    const { value: normalised } = normalise(text)
    onChange(normalised)
  }

  /** Lahkumisel viime kuju korda: "9" → "09:00", "1500" → "15:00". */
  const handleBlur = () => {
    const { value: normalised, valid } = normalise(raw)
    if (valid && normalised) setRaw(normalised)
  }

  const { valid } = normalise(raw)
  const showError = raw.trim() !== '' && !valid

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={e => handleChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label="Kellaaeg, kujul 15:00"
      className={`${className} ${showError ? 'border-[#E24B4A]' : ''}`}
      {...rest}
    />
  )
}

/**
 * "1500" | "15:00" | "15.00" | "9" → { value: "15:00", valid: true }
 * Poolik või vigane sisestus → { value: "", valid: false }, nii et vorm ei
 * salvesta kunagi katkist aega.
 */
function normalise(text) {
  const digits = String(text ?? '').replace(/\D/g, '')
  if (!digits) return { value: '', valid: String(text ?? '').trim() === '' }

  let h
  let m
  if (digits.length <= 2) {
    h = Number(digits)
    m = 0
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1))
    m = Number(digits.slice(1))
  } else {
    h = Number(digits.slice(0, 2))
    m = Number(digits.slice(2, 4))
  }

  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) {
    return { value: '', valid: false }
  }

  return {
    value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    valid: true,
  }
}
