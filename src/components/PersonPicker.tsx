import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../lib/types'

interface PersonPickerProps {
  people: Profile[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  excludeIds?: string[]
  inputId?: string
}

// İsim veya e-posta yazarak arama yapılan kişi seçici.
export default function PersonPicker({
  people,
  value,
  onChange,
  placeholder = 'İsim veya e-posta yaz…',
  excludeIds = [],
  inputId,
}: PersonPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = people.find((p) => p.id === value) ?? null

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const q = query.trim().toLowerCase()
  const options = people
    .filter((p) => !excludeIds.includes(p.id))
    .filter(
      (p) =>
        !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    )
    .slice(0, 8)

  if (selected) {
    return (
      <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
        <span className="truncate text-gray-900">
          {selected.name}
          <span className="ml-2 text-xs text-gray-400">{selected.email}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange('')
            setQuery('')
          }}
          className="shrink-0 text-xs text-rose-600 hover:underline"
        >
          Değiştir
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50"
              >
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-500">{p.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.length > 0 && options.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          Eşleşen kayıtlı kullanıcı yok. Kayıtlı değilse e-postayla davet bölümünü
          kullan.
        </p>
      )}
    </div>
  )
}
