import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Apple,
  ArrowDownRight,
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  LayoutDashboard,
  LineChart as LineChartIcon,
  ListChecks,
  LogOut,
  Plus,
  Scale,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  EXERCISE_LIBRARY,
  FOOD_LIBRARY,
  NAV_ITEMS,
  PROFILES,
  addDays,
  calculateExerciseCalories,
  calculateFoodCalories,
  toDateKey,
} from './data'
import { useAuth } from './auth'
import { useRecords } from './records'
import { useProfileSettings } from './settings'
import { useActivity } from './activity'
import { ClaimScreen, FullScreenLoader, LoginScreen } from './auth-ui'

const ICONS = {
  overview: LayoutDashboard,
  checkin: ClipboardCheck,
  trend: LineChartIcon,
  meals: Utensils,
  summary: ListChecks,
}

const PERIODS = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
]

const MEAL_TYPES = ['早餐', '午餐', '晚餐', '加餐']

// 热量状态判定阈值（kcal）：高于建议 +150 视为「超出建议」，低于建议 300 以上视为「摄入偏低」
const CALORIE_OVER_THRESHOLD = 150
const CALORIE_UNDER_THRESHOLD = -300

// 静态展示数据：陪伴天数与连胜徽章展示上限（暂无真实数据源，后续可接入）
const DAYS_TOGETHER = 128
const STREAK_DISPLAY_CAP = 12

const parseDate = (dateKey) => new Date(`${dateKey}T12:00:00`)
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const sum = (items, getValue) => items.reduce((total, item) => total + getValue(item), 0)

function getWeekStart(date) {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setDate(next.getDate() - day + 1)
  return next
}

function getPeriodBounds(selectedDate, period) {
  const start = new Date(selectedDate)
  const end = new Date(selectedDate)

  if (period === 'week') {
    const weekStart = getWeekStart(selectedDate)
    return { start: weekStart, end: addDays(weekStart, 6) }
  }

  if (period === 'month') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
  }

  if (period === 'year') {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }

  return { start, end }
}

function formatPeriodLabel(date, period) {
  const formatMonthDay = (value) => `${value.getMonth() + 1}月${value.getDate()}日`
  if (period === 'day') return `${date.getFullYear()}年${formatMonthDay(date)}`
  if (period === 'week') {
    const { start, end } = getPeriodBounds(date, period)
    return `${formatMonthDay(start)} – ${formatMonthDay(end)}`
  }
  if (period === 'month') return `${date.getFullYear()}年 ${date.getMonth() + 1}月`
  return `${date.getFullYear()}年`
}

function shiftDate(date, period, direction) {
  const next = new Date(date)
  if (period === 'day') next.setDate(next.getDate() + direction)
  if (period === 'week') next.setDate(next.getDate() + direction * 7)
  if (period === 'month') next.setMonth(next.getMonth() + direction)
  if (period === 'year') next.setFullYear(next.getFullYear() + direction)
  return next
}

function getCalorieStatus(actual, target) {
  const delta = actual - target
  if (delta > CALORIE_OVER_THRESHOLD) return { label: '超出建议', tone: 'danger', delta }
  if (delta < CALORIE_UNDER_THRESHOLD) return { label: '摄入偏低', tone: 'warning', delta }
  return { label: '健康范围', tone: 'success', delta }
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Math.round(value || 0))
}

function formatExerciseSummary(record) {
  if (!record) return ''
  return [
    record.exercise,
    record.speed ? `${record.speed} km/h` : null,
    record.incline ? `坡度 ${record.incline}%` : null,
    `${record.duration} 分钟`,
  ].filter(Boolean).join(' · ')
}

function Avatar({ profile, size = 'medium', online = false }) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-color': profile.color, '--avatar-soft': profile.softColor }}
      aria-label={profile.name}
    >
      {profile.initials}
      {online && <span className="online-dot" />}
    </span>
  )
}

function StatusPill({ status }) {
  return (
    <span className={`status-pill ${status.tone}`}>
      <span className="status-dot" />
      {status.label}
    </span>
  )
}

function ProgressRing({ percentage, color, children }) {
  const safePercentage = clamp(percentage, 0, 110)
  return (
    <div
      className="progress-ring"
      style={{
        '--ring-color': color,
        '--ring-progress': `${Math.min(safePercentage, 100) * 3.6}deg`,
      }}
    >
      <div className="progress-ring-inner">{children}</div>
    </div>
  )
}

function SummaryCard({ profile, records, period, onInspect }) {
  const days = new Set(records.map((record) => record.date)).size || 1
  const calories = sum(records, (record) => record.calories)
  const burned = sum(records, (record) => record.burned)
  const duration = sum(records, (record) => record.duration)
  const averageCalories = calories / days
  const targetTotal = profile.targetCalories * days
  const status = records.length
    ? getCalorieStatus(averageCalories, profile.targetCalories)
    : { label: '暂无记录', tone: 'neutral', delta: 0 }
  const latestRecord = [...records].sort((a, b) => b.date.localeCompare(a.date))[0]
  const weight = latestRecord?.weight ?? profile.startWeight
  const lostWeight = Math.max(0, profile.startWeight - weight)
  const weightGoal = profile.startWeight - profile.targetWeight
  const goalProgress = clamp((lostWeight / weightGoal) * 100, 0, 100)
  const intakePercentage = (calories / targetTotal) * 100

  return (
    <article className="person-summary" style={{ '--person-color': profile.color, '--person-soft': profile.softColor }}>
      <div className="person-summary-top">
        <div className="person-id">
          <Avatar profile={profile} size="large" online />
          <div>
            <div className="person-name-row">
              <h3>{profile.name}</h3>
              <StatusPill status={status} />
            </div>
            <p>{records.length ? `本周期已打卡 ${days} 天` : '本周期还没有打卡'}</p>
          </div>
        </div>
        <button
          className="icon-button subtle"
          aria-label={`查看${profile.name}详情`}
          onClick={() => latestRecord && onInspect(latestRecord)}
          disabled={!latestRecord}
        >
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="calorie-summary">
        <ProgressRing percentage={intakePercentage} color={profile.color}>
          <strong>{Math.round(intakePercentage)}%</strong>
          <span>建议摄入</span>
        </ProgressRing>
        <div className="calorie-copy">
          <span className="eyebrow">{period === 'day' ? '今日摄入' : '日均摄入'}</span>
          <div className="big-number">
            {formatNumber(period === 'day' ? calories : averageCalories)}
            <small>kcal</small>
          </div>
          <p>建议 {formatNumber(profile.targetCalories)} kcal / 天</p>
        </div>
      </div>

      <div className="summary-metrics">
        <div>
          <span className="metric-icon flame"><Flame size={16} /></span>
          <div><strong>{formatNumber(burned)}</strong><span>运动消耗 kcal</span></div>
        </div>
        <div>
          <span className="metric-icon time"><Activity size={16} /></span>
          <div><strong>{formatNumber(duration)}</strong><span>运动分钟</span></div>
        </div>
      </div>

      <div className="weight-progress">
        <div className="weight-progress-label">
          <span><Scale size={15} /> 体重目标</span>
          <strong>{weight.toFixed(1)} <small>/ {profile.targetWeight} kg</small></strong>
        </div>
        <div className="progress-track"><span style={{ width: `${goalProgress}%` }} /></div>
        <div className="weight-progress-foot">
          <span>已减 {lostWeight.toFixed(1)} kg</span>
          <span>完成 {Math.round(goalProgress)}%</span>
        </div>
      </div>
    </article>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey}>
          <span style={{ background: item.color }} />
          {item.name}<b>{formatNumber(item.value)} kcal</b>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ records, period, metric, profiles }) {
  const chartData = useMemo(() => {
    if (period === 'day') {
      return MEAL_TYPES.map((type) => {
        const point = { label: type }
        profiles.forEach((profile) => {
          const profileMeals = records
            .filter((record) => record.profileId === profile.id)
            .flatMap((record) => record.meals || [])
          point[profile.id] = sum(profileMeals.filter((meal) => meal.type === type), (meal) => meal.calories)
        })
        return point
      })
    }

    const dates = [...new Set(records.map((record) => record.date))].sort()
    return dates.map((date) => {
      const point = {
        label: `${parseDate(date).getMonth() + 1}/${parseDate(date).getDate()}`,
      }
      profiles.forEach((profile) => {
        const matching = records.filter((record) => record.date === date && record.profileId === profile.id)
        point[profile.id] = sum(matching, (record) =>
          metric === 'net' ? Math.max(0, record.calories - record.burned) : record.calories,
        )
      })
      return point
    })
  }, [records, period, metric, profiles])

  const emptyPoint = Object.fromEntries(profiles.map((profile) => [profile.id, 0]))
  const data = chartData.length ? chartData : [{ label: '暂无', ...emptyPoint }]
  const targetReference = profiles.length
    ? profiles.reduce((total, profile) => total + (profile.targetCalories || 0), 0) / profiles.length
    : 0

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <defs>
            {profiles.map((profile) => (
              <linearGradient key={profile.id} id={`gradient-${profile.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={profile.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={profile.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#ebece7" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8c9088', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a49e', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#d4d6cf', strokeDasharray: '3 3' }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={40}
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="legend-label">{value}</span>}
          />
          {period !== 'day' && metric === 'intake' && profiles.length > 1 && (
            <ReferenceLine y={targetReference} stroke="#bcc0b9" strokeDasharray="6 5" />
          )}
          {profiles[0] && (
            <Area
              type="monotone"
              dataKey={profiles[0].id}
              fill={`url(#gradient-${profiles[0].id})`}
              stroke="none"
              legendType="none"
            />
          )}
          {profiles.map((profile) => (
            <Line
              key={profile.id}
              type="monotone"
              dataKey={profile.id}
              name={profile.name}
              stroke={profile.color}
              strokeWidth={3}
              dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function MealColumn({ profile, record }) {
  const status = record
    ? getCalorieStatus(record.calories, profile.targetCalories)
    : { label: '暂无记录', tone: 'neutral', delta: 0 }
  return (
    <div className="meal-column" style={{ '--person-color': profile.color }}>
      <div className="meal-column-head">
        <div><Avatar profile={profile} size="small" /><strong>{profile.name}</strong></div>
        <span>{formatNumber(record?.calories)} kcal</span>
      </div>
      <div className="meal-list">
        {MEAL_TYPES.map((type, index) => {
          const mealItems = record?.meals?.filter((item) => item.type === type) || []
          const meal = mealItems.length
            ? {
                name: mealItems.map((item) => item.name).join(' · '),
                calories: sum(mealItems, (item) => item.calories),
              }
            : null
          return (
            <div className="meal-row" key={type}>
              <span className={`meal-icon meal-${index}`}>
                {index === 0 ? <Zap size={16} /> : index === 1 ? <Utensils size={16} /> : index === 2 ? <Apple size={16} /> : <Sparkles size={16} />}
              </span>
              <div className="meal-info">
                <span>{type}</span>
                <strong>{meal?.name || '尚未记录'}</strong>
              </div>
              <b>{meal ? `${meal.calories}` : '--'} <small>kcal</small></b>
            </div>
          )
        })}
      </div>
      <div className={`meal-total ${status.tone}`}>
        <div>
          <span>对比个人建议值</span>
          <strong>{status.delta > 0 ? '+' : ''}{formatNumber(status.delta)} kcal</strong>
        </div>
        <StatusPill status={status} />
      </div>
    </div>
  )
}

const DEFAULT_FOOD_BY_MEAL = {
  早餐: 'oats',
  午餐: 'chicken_breast',
  晚餐: 'salmon',
  加餐: 'yogurt',
}

const createMealItem = (type, foodId = DEFAULT_FOOD_BY_MEAL[type], grams = 100) => ({
  id: `meal-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type,
  foodId,
  grams: String(grams),
  customName: '',
  customKcalPer100g: '',
})

const createDefaultMeals = () => MEAL_TYPES.map((type) => createMealItem(type))

function CheckinModal({ isOpen, onClose, onSubmit, defaultDate, profileLock = null, profileSettings = null }) {
  const [profileId, setProfileId] = useState(profileLock || PROFILES[0].id)
  const [date, setDate] = useState(toDateKey(defaultDate))
  const [weight, setWeight] = useState('56.3')
  const [exerciseId, setExerciseId] = useState('brisk_walk')
  const [duration, setDuration] = useState('40')
  const [treadmillSpeed, setTreadmillSpeed] = useState('8')
  const [treadmillIncline, setTreadmillIncline] = useState('2')
  const [water, setWater] = useState('1800')
  const [mood, setMood] = useState('轻盈')
  const [mealItems, setMealItems] = useState(createDefaultMeals)

  useEffect(() => setDate(toDateKey(defaultDate)), [defaultDate, isOpen])

  useEffect(() => {
    if (profileLock) setProfileId(profileLock)
  }, [profileLock])

  useEffect(() => {
    setWeight(String(profileSettings?.startWeight ?? (profileId === 'lin' ? 56.3 : 74.4)))
    setWater(profileId === 'lin' ? '1800' : '2400')
  }, [profileId, profileSettings?.startWeight])

  if (!isOpen) return null

  const selectedExercise = EXERCISE_LIBRARY.find((item) => item.id === exerciseId)
  const isTreadmill = selectedExercise?.mode === 'treadmill'
  const burned = calculateExerciseCalories(exerciseId, weight, duration, {
    speed: treadmillSpeed,
    incline: treadmillIncline,
  })
  const getItemCalories = (item) => calculateFoodCalories(item.foodId, item.grams, item.customKcalPer100g)
  const totalCalories = sum(mealItems, getItemCalories)

  const updateMealItem = (id, field, value) => {
    setMealItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  const addMealItem = (type) => {
    setMealItems((current) => [...current, createMealItem(type, DEFAULT_FOOD_BY_MEAL[type], 100)])
  }

  const removeMealItem = (id) => {
    setMealItems((current) => current.filter((item) => item.id !== id))
  }

  const submit = (event) => {
    event.preventDefault()
    const meals = mealItems
      .filter((item) => Number(item.grams) > 0)
      .map((item) => {
        const food = FOOD_LIBRARY.find((foodItem) => foodItem.id === item.foodId)
        return {
          type: item.type,
          name: item.foodId === 'custom' ? (item.customName.trim() || '自定义食物') : food?.name || '未命名食物',
          foodId: item.foodId,
          grams: Number(item.grams),
          kcalPer100g: item.foodId === 'custom' ? Number(item.customKcalPer100g) || 0 : food?.kcalPer100g || 0,
          calories: getItemCalories(item),
        }
      })

    onSubmit({
      id: `record-${profileId}-${date}-${Date.now()}`,
      profileId,
      date,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      calories: sum(meals, (meal) => meal.calories),
      weight: Number(weight),
      exercise: selectedExercise?.name || '休息日',
      exerciseId,
      duration: Number(duration),
      burned,
      speed: isTreadmill ? Number(treadmillSpeed) || 0 : null,
      incline: isTreadmill ? Number(treadmillIncline) || 0 : null,
      water: Number(water),
      mood,
      meals,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="checkin-modal" role="dialog" aria-modal="true" aria-label="新增健康打卡">
        <div className="modal-head">
          <div>
            <span className="section-kicker"><Sparkles size={14} /> KEEP GOING</span>
            <h2>记录今天的好状态</h2>
            <p>选择食物与运动，热量会随着克数和时长实时计算。</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="form-section">
            <label className="form-label">{profileLock ? '本次打卡记给' : '谁来打卡'}</label>
            <div className="profile-select">
              {(profileLock ? PROFILES.filter((person) => person.id === profileLock) : PROFILES).map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  className={profileId === profile.id ? 'selected' : ''}
                  onClick={() => !profileLock && setProfileId(profile.id)}
                  disabled={Boolean(profileLock)}
                  style={{ '--person-color': profile.color, '--person-soft': profile.softColor }}
                >
                  <Avatar profile={profile} size="small" />
                  <span>{profile.name}</span>
                  {profileId === profile.id && <Check size={16} />}
                </button>
              ))}
            </div>
            {profileLock && (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8c9088' }}>
                已登录为 {PROFILES.find((person) => person.id === profileLock)?.name}，打卡将保存到你的档案。
              </p>
            )}
          </div>

          <div className="form-grid form-section">
            <label>
              <span className="form-label">打卡日期</span>
              <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              <span className="form-label">当前体重 <small>kg</small></span>
              <input type="number" step="0.1" min="30" max="250" required value={weight} onChange={(event) => setWeight(event.target.value)} />
            </label>
            <label>
              <span className="form-label">运动项目</span>
              <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>
                {EXERCISE_LIBRARY.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span className="form-label">运动时长 <small>分钟</small></span>
              <input type="number" min="0" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </label>
            {isTreadmill && (
              <>
                <label>
                  <span className="form-label">跑步机速度 <small>km/h</small></span>
                  <input type="number" min="1" max="20" step="0.1" value={treadmillSpeed} onChange={(event) => setTreadmillSpeed(event.target.value)} />
                </label>
                <label>
                  <span className="form-label">跑步机坡度 <small>%</small></span>
                  <input type="number" min="0" max="15" step="0.5" value={treadmillIncline} onChange={(event) => setTreadmillIncline(event.target.value)} />
                </label>
              </>
            )}
            <label>
              <span className="form-label">运动消耗 <small>自动估算</small></span>
              <div className="calculated-field"><Flame size={15} /><strong>{formatNumber(burned)}</strong><span>kcal</span></div>
            </label>
            <label>
              <span className="form-label">饮水 <small>ml</small></span>
              <input type="number" min="0" value={water} onChange={(event) => setWater(event.target.value)} />
            </label>
          </div>

          <div className="exercise-formula">
            <Activity size={16} />
            <span>
              {isTreadmill
                ? <>跑步机：{treadmillSpeed || 0} km/h · 坡度 {treadmillIncline || 0}% · {duration || 0} 分钟（ACSM 公式估算）</>
                : <><b>{selectedExercise?.name}</b>：MET {selectedExercise?.met} × 3.5 × {weight || 0} kg ÷ 200 × {duration || 0} 分钟</>}
            </span>
            <strong>{formatNumber(burned)} kcal</strong>
          </div>

          <div className="form-section food-form-section">
            <div className="form-section-title">
              <div><span className="form-label">今日饮食</span><small>选择食物并填写实际克数</small></div>
              <strong>{formatNumber(totalCalories)} <small>kcal</small></strong>
            </div>
            <div className="meal-groups">
              {MEAL_TYPES.map((type) => {
                const items = mealItems.filter((item) => item.type === type)
                const mealTotal = sum(items, getItemCalories)
                return (
                  <div className="meal-input-group" key={type}>
                    <div className="meal-input-head">
                      <div><strong>{type}</strong><span>{formatNumber(mealTotal)} kcal</span></div>
                      <button type="button" onClick={() => addMealItem(type)}><Plus size={14} /> 添加食物</button>
                    </div>
                    {items.length === 0 && <div className="empty-meal">尚未添加食物</div>}
                    {items.map((item) => {
                      const food = FOOD_LIBRARY.find((foodItem) => foodItem.id === item.foodId)
                      const calories = getItemCalories(item)
                      const customFood = item.foodId === 'custom'
                      return (
                        <div className={`food-input-row ${customFood ? 'custom' : ''}`} key={item.id}>
                          <label>
                            <span>食物</span>
                            <select value={item.foodId} onChange={(event) => updateMealItem(item.id, 'foodId', event.target.value)}>
                              {FOOD_LIBRARY.map((foodItem) => (
                                <option key={foodItem.id} value={foodItem.id}>{foodItem.name} · {foodItem.kcalPer100g} kcal/100g</option>
                              ))}
                            </select>
                          </label>
                          {customFood && (
                            <label className="custom-food-name">
                              <span>自定义食物名称</span>
                              <input type="text" placeholder="输入食物名称" value={item.customName} onChange={(event) => updateMealItem(item.id, 'customName', event.target.value)} />
                            </label>
                          )}
                          <label className="grams-field">
                            <span>进食量</span>
                            <div><input type="number" min="0" max="5000" step="1" value={item.grams} onChange={(event) => updateMealItem(item.id, 'grams', event.target.value)} /><i>g</i></div>
                          </label>
                          {customFood && (
                            <label className="custom-kcal-field">
                              <span>每100克热量</span>
                              <div><input type="number" min="0" max="1000" value={item.customKcalPer100g} placeholder="热量" onChange={(event) => updateMealItem(item.id, 'customKcalPer100g', event.target.value)} /><i>kcal</i></div>
                            </label>
                          )}
                          <div className="food-calorie-result">
                            <span>{customFood ? (Number(item.customKcalPer100g) || 0) : food?.kcalPer100g || 0} kcal/100g</span>
                            <strong>{formatNumber(calories)} <small>kcal</small></strong>
                          </div>
                          <button type="button" className="remove-food" onClick={() => removeMealItem(item.id)} aria-label={`删除${type}食物`}><Trash2 size={15} /></button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="form-grid compact form-section">
            <label>
              <span className="form-label">今日感受</span>
              <input type="text" value={mood} onChange={(event) => setMood(event.target.value)} />
            </label>
          </div>

          <div className="modal-actions">
            <p><CircleHelp size={15} /> 食物与运动热量均为估算值，具体以包装标示和实际强度为准。</p>
            <button type="submit" className="primary-button"><Check size={17} /> 完成打卡</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ResetDataModal({ isOpen, onClose, onConfirm, recordCount, shared = false }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop reset-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="reset-modal" role="alertdialog" aria-modal="true" aria-label="初始化数据确认">
        <span className="reset-icon"><Trash2 size={23} /></span>
        <h2>{shared ? '清空我的打卡数据？' : '初始化并清空数据？'}</h2>
        <p>{shared ? '这会永久删除你当前保存的' : `这会永久删除${PROFILES.map((person) => person.name).join('和')}当前保存的`} <strong>{recordCount} 条</strong>打卡记录，清空后将从零开始正式使用。</p>
        <div className="reset-warning"><CircleHelp size={16} /> {shared ? '云端数据删除后无法恢复，请确认不再需要这些记录。' : '本机浏览器数据无法恢复，请确认不再需要示例或历史记录。'}</div>
        <div className="reset-actions">
          <button type="button" className="outline-button" onClick={onClose}>取消</button>
          <button type="button" className="danger-button" onClick={onConfirm}><Trash2 size={16} /> 确认清空</button>
        </div>
      </section>
    </div>
  )
}

function SettingsModal({ isOpen, onClose, profiles, settings, onSave, currentProfileId, onSignOut }) {
  const [profileId, setProfileId] = useState(currentProfileId || PROFILES[0].id)
  const [values, setValues] = useState(settings[profileId] || {})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (currentProfileId) setProfileId(currentProfileId)
  }, [currentProfileId, isOpen])

  useEffect(() => {
    setValues(settings[profileId] || {})
    setMessage('')
  }, [profileId, settings])

  if (!isOpen) return null

  const selectedProfile = PROFILES.find((person) => person.id === profileId)
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await onSave(profileId, {
      targetCalories: Number(values.targetCalories),
      targetWeight: Number(values.targetWeight),
      startWeight: Number(values.startWeight),
      height: Number(values.height),
      weeklyGoal: Number(values.weeklyGoal),
    })
    setBusy(false)
    if (error) {
      setMessage(`保存失败：${error.message}`)
      return
    }
    setMessage('目标已保存，并已同步到共享空间。')
    window.setTimeout(onClose, 650)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="个人与目标设置">
        <div className="modal-head">
          <div>
            <span className="section-kicker"><Settings size={14} /> PERSONAL GOALS</span>
            <h2>个人与目标设置</h2>
            <p>设置会同步到共享空间，并用于热量与体重进度计算。</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="settings-form">
          {profiles.length > 1 && (
            <div className="settings-profile-select">
              {profiles.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={profileId === person.id ? 'active' : ''}
                  onClick={() => setProfileId(person.id)}
                >
                  <Avatar profile={person} size="small" />
                  <span>{person.name}{person.id === currentProfileId ? '（我）' : ''}</span>
                </button>
              ))}
            </div>
          )}
          <div className="settings-selected-person">
            <Avatar profile={selectedProfile} size="medium" />
            <div><strong>{selectedProfile?.name}</strong><span>用于个性化建议与进度计算</span></div>
          </div>
          <div className="settings-grid">
            <label><span>每日建议摄入 <small>kcal</small></span><input required type="number" min="800" max="5000" value={values.targetCalories ?? ''} onChange={(event) => update('targetCalories', event.target.value)} /></label>
            <label><span>目标体重 <small>kg</small></span><input required type="number" min="30" max="250" step="0.1" value={values.targetWeight ?? ''} onChange={(event) => update('targetWeight', event.target.value)} /></label>
            <label><span>起始体重 <small>kg</small></span><input required type="number" min="30" max="300" step="0.1" value={values.startWeight ?? ''} onChange={(event) => update('startWeight', event.target.value)} /></label>
            <label><span>身高 <small>cm</small></span><input required type="number" min="100" max="250" value={values.height ?? ''} onChange={(event) => update('height', event.target.value)} /></label>
            <label><span>每周运动目标 <small>次</small></span><input required type="number" min="1" max="14" value={values.weeklyGoal ?? ''} onChange={(event) => update('weeklyGoal', event.target.value)} /></label>
          </div>
          <div className="settings-hint"><CircleHelp size={15} /> 建议摄入量为日常健康管理参考，请结合身体状况谨慎设置。</div>
          {message && <p className={`settings-message ${message.startsWith('保存失败') ? 'error' : ''}`}>{message}</p>}
          <div className="settings-actions">
            {onSignOut && <button type="button" className="settings-signout" onClick={onSignOut}><LogOut size={15} /> 退出登录</button>}
            <button type="button" className="outline-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? '保存中…' : <><Check size={16} /> 保存设置</>}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ActivityPopover({ isOpen, onClose, activities, loading, profiles, onClear }) {
  if (!isOpen) return null

  const personName = (id) => profiles.find((person) => person.id === id)?.name || '双燃'
  const formatTime = (value) => {
    const date = new Date(value)
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }

  return (
    <>
      <button className="popover-dismiss" aria-label="关闭通知" onClick={onClose} />
      <section className="activity-popover" aria-label="活动与历史记录">
        <div className="activity-popover-head">
          <div><span className="panel-eyebrow">MEMORY LANE</span><h2>活动与历史记录</h2></div>
          <button className="icon-button subtle" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        <div className="activity-summary"><Clock3 size={15} /><span>最近的打卡、初始化等操作会显示在这里</span></div>
        <div className="activity-list">
          {loading && <div className="activity-empty">正在加载活动记录…</div>}
          {!loading && activities.length === 0 && (
            <div className="activity-empty"><span><Bell size={19} /></span><strong>还没有历史记录</strong><p>完成打卡或初始化数据后，会在这里留下记录。</p></div>
          )}
          {!loading && activities.map((activity) => (
            <article className="activity-entry" key={activity.id}>
              <span className={`activity-entry-icon ${activity.type}`}>
                {activity.type === 'reset' ? <Trash2 size={15} /> : activity.type === 'goal_update' ? <Settings size={15} /> : <Check size={15} />}
              </span>
              <div><strong>{activity.message}</strong><span>{personName(activity.profileId)} · {formatTime(activity.createdAt)}</span>
                {activity.type === 'checkin' && <small>{activity.recordDate} · 摄入 {formatNumber(activity.calories)} kcal</small>}
                {activity.type === 'reset' && <small>清除了 {activity.calories} 条记录</small>}
              </div>
            </article>
          ))}
        </div>
        <div className="activity-popover-foot">
          <span>保留最近 {activities.length} 条活动</span>
          {activities.length > 0 && onClear && <button onClick={onClear}>清除本机历史</button>}
        </div>
      </section>
    </>
  )
}

export default function App() {
  const { configured, session, profile, loading: authLoading, signOut } = useAuth()
  const {
    records,
    loading: recordsLoading,
    error: recordsError,
    isConnected,
    saveRecord,
    resetRecords,
  } = useRecords()
  const { settings, saveSettings } = useProfileSettings()
  const { activities, loading: activityLoading, logActivity, clearLocalActivities } = useActivity()

  const [activeNav, setActiveNav] = useState('overview')
  const [period, setPeriod] = useState('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [chartMetric, setChartMetric] = useState('intake')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [showStandards, setShowStandards] = useState(false)
  const [toast, setToast] = useState('')

  const visibleProfiles = useMemo(
    () => PROFILES.map((person) => ({ ...person, ...settings[person.id] })),
    [settings],
  )

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const filteredRecords = useMemo(() => {
    const { start, end } = getPeriodBounds(selectedDate, period)
    const startKey = toDateKey(start)
    const endKey = toDateKey(end)
    return records.filter((record) => record.date >= startKey && record.date <= endKey)
  }, [records, selectedDate, period])

  const selectedDayRecords = useMemo(() => {
    const key = toDateKey(selectedDate)
    return visibleProfiles.map((profile) =>
      records
        .filter((record) => record.profileId === profile.id && record.date === key)
        .sort((a, b) => b.time.localeCompare(a.time))[0],
    )
  }, [records, selectedDate, settings])

  const totalCheckinDays = new Set(records.map((record) => record.date)).size
  const pairedDays = useMemo(() => {
    const { start, end } = getPeriodBounds(new Date(), 'week')
    const startKey = toDateKey(start)
    const endKey = toDateKey(end)
    const profilesByDate = {}
    records.forEach((record) => {
      if (record.date < startKey || record.date > endKey) return
      const profiles = (profilesByDate[record.date] ||= new Set())
      profiles.add(record.profileId)
    })
    return Object.values(profilesByDate).filter((set) => set.size === PROFILES.length).length
  }, [records])

  const goToSection = (id) => {
    setActiveNav(id)
    const targetId = id === 'overview' ? 'top' : id
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (id === 'checkin') window.setTimeout(() => setIsModalOpen(true), 320)
  }

  const handleSaveRecord = async (record) => {
    const { error } = await saveRecord(record)
    if (error) {
      setToast(`保存失败：${error.message}`)
      return
    }
    setSelectedDate(parseDate(record.date))
    setPeriod('day')
    const person = PROFILES.find((item) => item.id === record.profileId)
    setToast(`${person.name}的今日打卡已保存`)
    const { error: activityError } = await logActivity({
      profileId: record.profileId,
      type: 'checkin',
      recordDate: record.date,
      calories: record.calories,
      message: `${person.name}完成了今日打卡`,
    })
    if (activityError) setToast('打卡已保存，但活动记录暂时无法同步')
  }

  const inspectRecord = (record) => {
    setSelectedDate(parseDate(record.date))
    setPeriod('day')
    window.setTimeout(() => document.getElementById('meals')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const resetAllData = async () => {
    const profileId = configured && profile ? profile.id : null
    const { error } = await resetRecords(profileId)
    if (error) {
      setToast(`清空失败：${error.message}`)
      setIsResetModalOpen(false)
      return
    }
    const person = PROFILES.find((item) => item.id === profileId)
    const { error: activityError } = await logActivity({
      profileId,
      type: 'reset',
      calories: myRecordCount,
      message: configured
        ? `${person?.name || '成员'}初始化了自己的打卡数据`
        : '初始化了本地打卡数据',
    })
    setSelectedDate(new Date())
    setPeriod('day')
    setIsResetModalOpen(false)
    setToast(activityError ? '数据已清空，但操作历史暂时无法同步' : configured ? '你的打卡数据已清空' : '数据已初始化，可以开始正式打卡')
  }

  const handleSaveSettings = async (profileId, values) => {
    const { error } = await saveSettings(profileId, values)
    if (error) return { error }
    const person = PROFILES.find((item) => item.id === profileId)
    const { error: activityError } = await logActivity({
      profileId,
      type: 'goal_update',
      message: `${person?.name || '成员'}更新了个人健康目标`,
    })
    if (activityError) setToast('目标已保存，但活动记录暂时无法同步')
    return { error: null }
  }

  const clearLocalActivity = () => {
    if (configured) {
      setToast('云端历史由双方共享，暂不提供单端清除')
      return
    }
    clearLocalActivities()
  }

  const settingsProfiles = configured && profile
    ? visibleProfiles.filter((person) => person.id === profile.id)
    : visibleProfiles

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date())

  const myRecordCount = configured && profile
    ? records.filter((record) => record.profileId === profile.id).length
    : records.length

  if (configured) {
    if (authLoading) return <FullScreenLoader label="正在连接…" />
    if (!session) return <LoginScreen />
    if (!profile) return <ClaimScreen />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => goToSection('overview')}>
          <span className="brand-mark"><Flame size={19} fill="currentColor" /></span>
          <span><strong>双燃</strong><small>DUO FIT</small></span>
        </button>

        <nav className="main-nav" aria-label="主导航">
          <span className="nav-caption">空间</span>
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.id]
            return (
              <button
                key={item.id}
                className={activeNav === item.id ? 'active' : ''}
                onClick={() => goToSection(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === 'checkin' && <i>{pairedDays}/7</i>}
              </button>
            )
          })}
        </nav>

        <div className="pair-card">
          <div className="pair-card-art">
            <span><Heart size={17} fill="currentColor" /></span>
            <Footprints size={46} />
          </div>
          <span className="nav-caption">本周共同目标</span>
              <strong>一起完成 {Math.max(...visibleProfiles.map((person) => person.weeklyGoal || 4))} 次运动</strong>
          <div className="pair-progress"><span style={{ width: `${Math.min(100, (pairedDays / Math.max(...visibleProfiles.map((person) => person.weeklyGoal || 4))) * 100)}%` }} /></div>
          <p><b>{pairedDays}</b> / {Math.max(...visibleProfiles.map((person) => person.weeklyGoal || 4))} 次 · 继续并肩向前</p>
        </div>

        <div className="sidebar-bottom">
          <button onClick={() => setIsSettingsOpen(true)}><Settings size={18} /><span>个人与目标设置</span></button>
          <button className="data-reset-button" onClick={() => setIsResetModalOpen(true)}>
            <Trash2 size={18} /><span>初始化 / 清空数据</span>
          </button>
          {configured && (
            <button onClick={() => signOut()}><LogOut size={18} /><span>退出登录</span></button>
          )}
          <div className="sidebar-profile">
            <div className="avatar-stack">
              {visibleProfiles.map((profile) => <Avatar key={profile.id} profile={profile} size="small" online />)}
            </div>
            <div><strong>{visibleProfiles.map((person) => person.name).join(' & ')}</strong><span>相伴第 {DAYS_TOGETHER} 天</span></div>
            <ChevronRight size={16} />
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar" id="top">
          <div className="mobile-brand">
            <span className="brand-mark"><Flame size={17} fill="currentColor" /></span>
            <strong>双燃</strong>
          </div>
          <div className="date-overview">
            <CalendarDays size={18} />
            <div><span>今天</span><strong>{todayLabel}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button reset-shortcut" onClick={() => setIsResetModalOpen(true)} aria-label="初始化并清空数据" title="初始化并清空数据"><Trash2 size={18} /></button>
            <button className="icon-button settings-shortcut" onClick={() => setIsSettingsOpen(true)} aria-label="个人与目标设置" title="个人与目标设置"><Settings size={18} /></button>
            <button className="icon-button notification" aria-label="活动与历史记录" aria-expanded={isActivityOpen} onClick={() => setIsActivityOpen((value) => !value)}>
              <Bell size={19} />{activities.length > 0 && <span />}
            </button>
            <div className="avatar-stack">
              {visibleProfiles.map((profile) => <Avatar key={profile.id} profile={profile} size="small" />)}
            </div>
            <button className="primary-button top-checkin" onClick={() => setIsModalOpen(true)}>
              <Plus size={17} /> 今日打卡
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {recordsLoading && (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fff', color: '#8c9088', fontSize: '14px', margin: '0 0 12px' }}>
              正在同步云端数据…
            </div>
          )}
          {recordsError && (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fff0eb', color: '#c23b2a', fontSize: '14px', margin: '0 0 12px' }}>
              数据加载出错：{recordsError}，请刷新页面重试。
            </div>
          )}
          <section className="welcome-row">
            <div>
              <span className="section-kicker"><Sparkles size={14} /> EVERY DAY COUNTS</span>
              <h1>嗨，今天也一起<br /><em>向更好的自己靠近。</em></h1>
              <p>你们已经共同坚持 <strong>{totalCheckinDays} 天</strong>，每一次记录都值得被看见。</p>
            </div>
            <div className="streak-card">
              <span className="streak-icon"><Award size={24} /></span>
              <div><small>连续共同打卡</small><strong>{Math.min(totalCheckinDays, STREAK_DISPLAY_CAP)}<span>天</span></strong></div>
              <div className="streak-days">
                {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
                  <span key={day} className={index < Math.min(pairedDays, 7) ? 'done' : index === pairedDays ? 'today' : ''}>
                    <i>{index < pairedDays ? <Check size={11} /> : day}</i>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="filter-bar" aria-label="筛选记录范围">
            <div className="period-tabs">
              {PERIODS.map((item) => (
                <button key={item.id} className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="date-switcher">
              <button className="icon-button" onClick={() => setSelectedDate(shiftDate(selectedDate, period, -1))}><ChevronLeft size={18} /></button>
              <label>
                <CalendarDays size={16} />
                <span>{formatPeriodLabel(selectedDate, period)}</span>
                <input type="date" value={toDateKey(selectedDate)} onChange={(event) => setSelectedDate(parseDate(event.target.value))} />
              </label>
              <button className="icon-button" onClick={() => setSelectedDate(shiftDate(selectedDate, period, 1))}><ChevronRight size={18} /></button>
              <button className="today-button" onClick={() => setSelectedDate(new Date())}>回到今天</button>
            </div>
          </section>

          <section className="comparison-grid" id="summary">
            {visibleProfiles.map((profile) => (
              <SummaryCard
                key={profile.id}
                profile={profile}
                period={period}
                records={filteredRecords.filter((record) => record.profileId === profile.id)}
                onInspect={inspectRecord}
              />
            ))}
          </section>

          <section className="analytics-grid" id="trend">
            <article className="panel trend-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-eyebrow">CALORIE TREND</span>
                  <h2>{period === 'day' ? '餐次热量分布' : '摄入热量趋势'}</h2>
                  <p>{formatPeriodLabel(selectedDate, period)} · 双人对比</p>
                </div>
                {period !== 'day' && (
                  <div className="metric-switch">
                    <button className={chartMetric === 'intake' ? 'active' : ''} onClick={() => setChartMetric('intake')}>摄入</button>
                    <button className={chartMetric === 'net' ? 'active' : ''} onClick={() => setChartMetric('net')}>净摄入</button>
                  </div>
                )}
              </div>
              <TrendChart records={filteredRecords} period={period} metric={chartMetric} profiles={visibleProfiles} />
              <div className="chart-note">
                <span><Target size={16} /> 灰色虚线为两人目标热量的中间参考值</span>
                <span>净摄入 = 食物热量 − 记录的运动消耗</span>
              </div>
            </article>

            <article className="panel balance-panel">
              <div className="panel-head compact">
                <div>
                  <span className="panel-eyebrow">TODAY'S BALANCE</span>
                  <h2>今日能量状态</h2>
                </div>
                <span className="live-badge"><span /> 实时</span>
              </div>
              <div className="balance-list">
                {visibleProfiles.map((profile, index) => {
                  const record = selectedDayRecords[index]
                  const actual = record?.calories || 0
                  const status = record
                    ? getCalorieStatus(actual, profile.targetCalories)
                    : { label: '暂无记录', tone: 'neutral', delta: 0 }
                  const remaining = profile.targetCalories - actual
                  return (
                    <div className="balance-item" key={profile.id} style={{ '--person-color': profile.color, '--person-soft': profile.softColor }}>
                      <div className="balance-person"><Avatar profile={profile} size="small" /><div><strong>{profile.name}</strong><span>{record ? formatExerciseSummary(record) : '今日尚未打卡'}</span></div></div>
                      <div className="balance-bar-label"><span>摄入 {formatNumber(actual)}</span><span>建议 {formatNumber(profile.targetCalories)}</span></div>
                      <div className="balance-bar"><span style={{ width: `${clamp((actual / profile.targetCalories) * 100, 0, 100)}%` }} /></div>
                      <div className="balance-result">
                        <StatusPill status={status} />
                        <span>{remaining >= 0 ? `还可摄入约 ${formatNumber(remaining)} kcal` : `已超出约 ${formatNumber(Math.abs(remaining))} kcal`}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="health-tip">
                <span><TrendingDown size={18} /></span>
                <div><strong>温和减脂更容易坚持</strong><p>建议每日能量缺口约 300–500 kcal，并保证蛋白质与基础营养。</p></div>
              </div>
            </article>
          </section>

          <section className="panel meals-panel" id="meals">
            <div className="panel-head meals-head">
              <div>
                <span className="panel-eyebrow">MEAL LOG</span>
                <h2>今日饮食并列记录</h2>
                <p>{formatPeriodLabel(selectedDate, 'day')} · 点击打卡即可补充或修改</p>
              </div>
              <button className="outline-button" onClick={() => setIsModalOpen(true)}><Plus size={16} /> 记录饮食</button>
            </div>
            <div className="meal-comparison">
              {visibleProfiles.map((profile, index) => <MealColumn key={profile.id} profile={profile} record={selectedDayRecords[index]} />)}
            </div>
          </section>

          <section className={`standards-note ${showStandards ? 'open' : ''}`}>
            <span className="standards-icon"><Target size={20} /></span>
            <div className="standards-copy">
              <strong>健康标准说明</strong>
              <p>页面以个人建议摄入量及温和能量缺口为判断依据。健康减脂通常建议每周下降约 0.25–0.5 kg；实际需求会因年龄、身高、体重和活动量而异。</p>
            </div>
            <button onClick={() => setShowStandards((value) => !value)}>
              {showStandards ? '收起计算依据' : '查看计算依据'}
              <ArrowRight size={15} />
            </button>
            {showStandards && (
              <div className="standards-details">
                <div><b>健康范围</b><span>个人建议值 {CALORIE_UNDER_THRESHOLD} 至 +{CALORIE_OVER_THRESHOLD} kcal</span></div>
                <div><b>摄入偏低</b><span>低于个人建议值 {Math.abs(CALORIE_UNDER_THRESHOLD)} kcal 以上</span></div>
                <div><b>超出建议</b><span>高于个人建议值 {CALORIE_OVER_THRESHOLD} kcal 以上</span></div>
                <p>当前目标为 {visibleProfiles.map((person) => `${person.name} ${formatNumber(person.targetCalories)} kcal / 天`).join('、')}；这是一套日常记录提示规则，不是医学诊断或处方。</p>
              </div>
            )}
          </section>

          <footer>
            <span>双燃 DUO FIT · 两个人，一起成为更好的自己</span>
            <span>数据仅作日常健康管理参考，不替代专业医疗建议</span>
            {!isConnected && <span>当前为本地模式，数据仅保存在本机浏览器；配置 Supabase 后即可双人同步。</span>}
          </footer>
        </div>
      </main>

      <button className="floating-checkin" onClick={() => setIsModalOpen(true)}><Plus size={20} /><span>打卡</span></button>

      <CheckinModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveRecord}
        defaultDate={selectedDate}
        profileLock={configured && profile ? profile.id : null}
        profileSettings={profile ? settings[profile.id] : settings[profileLock || 'lin']}
      />

      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={resetAllData}
        recordCount={myRecordCount}
        shared={isConnected}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profiles={settingsProfiles}
        settings={settings}
        onSave={handleSaveSettings}
        currentProfileId={configured ? profile?.id : null}
        onSignOut={configured ? signOut : null}
      />

      <ActivityPopover
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        activities={activities}
        loading={activityLoading}
        profiles={visibleProfiles}
        onClear={!isConnected ? clearLocalActivity : null}
      />

      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
    </div>
  )
}
