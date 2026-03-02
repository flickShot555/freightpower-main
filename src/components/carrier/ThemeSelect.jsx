import React, { useState, useRef, useEffect } from 'react'

export default function ThemeSelect({ options = [], value, onChange = () => {}, ariaLabel, placeholder }){
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const ref = useRef(null)

  useEffect(()=>{
    function onDoc(e){
      if(ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=>document.removeEventListener('click', onDoc)
  },[])

  useEffect(()=>{
    if(!open) setHighlight(-1)
  },[open])

  const selected = options.find(o => o.value === value)

  function toggle(){ setOpen(s => !s) }
  function selectOpt(opt){ onChange(opt.value); setOpen(false) }

  function onKeyDown(e){
    if(e.key === 'ArrowDown'){ e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, options.length - 1)) }
    if(e.key === 'ArrowUp'){ e.preventDefault(); setOpen(true); setHighlight(h => Math.max(h - 1, 0)) }
    if(e.key === 'Enter' && open && highlight >= 0){ e.preventDefault(); selectOpt(options[highlight]) }
    if(e.key === 'Escape'){ setOpen(false) }
  }

  return (
    <div className="theme-select" ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="ts-button"
        onClick={toggle}
        aria-label={ariaLabel}
      >
        <span className="ts-value">{selected ? selected.label : (placeholder || '')}</span>
        <span className="ts-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <ul className="ts-menu" role="listbox" tabIndex={-1}>
          {options.map((opt, idx) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`ts-option ${highlight === idx ? 'highlight' : ''} ${value === opt.value ? 'selected' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => selectOpt(opt)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
