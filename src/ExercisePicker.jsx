import { useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { EXERCISE_LIBRARY } from './data'
import { EXERCISE_GROUPS, getQuickExercises } from './exercises'

export default function ExercisePicker({ value, onChange, records, profileId }) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const selected = EXERCISE_LIBRARY.find((item) => item.id === value)
  const quickExercises = getQuickExercises(records, profileId)
  const search = query.trim().toLocaleLowerCase()
  const groups = EXERCISE_GROUPS.map((group) => ({
    ...group,
    exercises: EXERCISE_LIBRARY.filter((item) => group.ids.includes(item.id)
      && (!search || `${item.name} ${group.name} ${item.id}`.toLocaleLowerCase().includes(search))),
  })).filter((group) => group.exercises.length)

  const renderChoice = (item) => (
    <button type="button" key={item.id} className={`exercise-choice ${value === item.id ? 'selected' : ''}`}
      aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
      <span>{item.name}</span>{value === item.id && <Check size={15} aria-hidden="true" />}
    </button>
  )

  return (
    <section className="exercise-picker" aria-labelledby="exercise-picker-title">
      <div className="exercise-picker-heading">
        <div><h3 id="exercise-picker-title">今天做了什么运动？</h3><p>快捷选择会优先显示你最近记录的运动</p></div>
        <button type="button" className={`exercise-rest ${value === 'rest' ? 'selected' : ''}`}
          aria-pressed={value === 'rest'} onClick={() => onChange('rest')}>
          {value === 'rest' && <Check size={14} aria-hidden="true" />}今天休息
        </button>
      </div>
      <div className="exercise-choices" role="group" aria-label="快捷运动">{quickExercises.map(renderChoice)}</div>
      <div className="exercise-picker-toolbar">
        <span className="exercise-selected" role="status">已选：<strong>{selected?.name}</strong></span>
        <button type="button" className="exercise-browse" aria-expanded={expanded} aria-controls="exercise-catalog"
          onClick={() => setExpanded((current) => !current)}>
          {expanded ? '收起全部运动' : '查看全部运动'}<ChevronDown size={15} className={expanded ? 'rotated' : ''} />
        </button>
      </div>
      {expanded && (
        <div id="exercise-catalog" className="exercise-catalog">
          <div className="exercise-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" aria-label="搜索运动" placeholder="搜索运动，如跑步、瑜伽、HIIT" value={query}
              onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
            {query && <button type="button" aria-label="清空运动搜索" onClick={() => setQuery('')}><X size={15} /></button>}
          </div>
          {groups.length ? groups.map((group) => (
            <div className="exercise-group" key={group.id}>
              <h4>{group.name}</h4>
              <div className="exercise-choices" role="group" aria-label={group.name}>{group.exercises.map(renderChoice)}</div>
            </div>
          )) : <p className="exercise-empty" role="status">没有找到相关运动，试试其他名称或清空搜索。</p>}
        </div>
      )}
    </section>
  )
}
