const pad = (value) => String(value).padStart(2, '0')

export const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const addDays = (date, amount) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export const PROFILES = [
  {
    id: 'lin',
    name: '小林',
    nickname: '小林',
    initials: '林',
    color: '#ff725e',
    softColor: '#fff0eb',
    targetCalories: 1450,
    targetWeight: 52,
    startWeight: 58.4,
    height: 163,
    weeklyGoal: 4,
  },
  {
    id: 'zhou',
    name: '小钟',
    nickname: '小钟',
    initials: '钟',
    color: '#6256e8',
    softColor: '#eeecff',
    targetCalories: 1850,
    targetWeight: 70,
    startWeight: 77.2,
    height: 178,
    weeklyGoal: 4,
  },
]

// 常见食物热量参考值，单位为 kcal / 100g。实际值会因品牌和烹饪方式有所浮动。
export const FOOD_LIBRARY = [
  { id: 'oats', name: '燕麦片', kcalPer100g: 379 },
  { id: 'whole_wheat_bread', name: '全麦面包', kcalPer100g: 247 },
  { id: 'egg', name: '鸡蛋', kcalPer100g: 143 },
  { id: 'milk', name: '牛奶', kcalPer100g: 54 },
  { id: 'yogurt', name: '无糖酸奶', kcalPer100g: 63 },
  { id: 'banana', name: '香蕉', kcalPer100g: 93 },
  { id: 'apple', name: '苹果', kcalPer100g: 53 },
  { id: 'blueberry', name: '蓝莓', kcalPer100g: 57 },
  { id: 'avocado', name: '牛油果', kcalPer100g: 171 },
  { id: 'chicken_breast', name: '鸡胸肉', kcalPer100g: 165 },
  { id: 'chicken_leg', name: '鸡腿肉', kcalPer100g: 181 },
  { id: 'beef', name: '牛肉', kcalPer100g: 250 },
  { id: 'pork_tenderloin', name: '猪里脊', kcalPer100g: 155 },
  { id: 'salmon', name: '三文鱼', kcalPer100g: 208 },
  { id: 'shrimp', name: '虾仁', kcalPer100g: 99 },
  { id: 'sea_bass', name: '鲈鱼', kcalPer100g: 123 },
  { id: 'tofu', name: '豆腐', kcalPer100g: 84 },
  { id: 'rice', name: '米饭（熟）', kcalPer100g: 116 },
  { id: 'brown_rice', name: '糙米饭（熟）', kcalPer100g: 111 },
  { id: 'quinoa', name: '藜麦（熟）', kcalPer100g: 120 },
  { id: 'soba', name: '荞麦面（熟）', kcalPer100g: 99 },
  { id: 'pasta', name: '意面（熟）', kcalPer100g: 158 },
  { id: 'sweet_potato', name: '红薯', kcalPer100g: 86 },
  { id: 'corn', name: '玉米', kcalPer100g: 112 },
  { id: 'pumpkin', name: '南瓜', kcalPer100g: 23 },
  { id: 'broccoli', name: '西兰花', kcalPer100g: 34 },
  { id: 'tomato', name: '番茄', kcalPer100g: 15 },
  { id: 'cucumber', name: '黄瓜', kcalPer100g: 16 },
  { id: 'lettuce', name: '生菜', kcalPer100g: 16 },
  { id: 'nuts', name: '混合坚果', kcalPer100g: 607 },
  { id: 'cooking_oil', name: '食用油', kcalPer100g: 884 },
  { id: 'latte', name: '拿铁咖啡', kcalPer100g: 54 },
  { id: 'protein_powder', name: '蛋白粉', kcalPer100g: 370 },
  { id: 'custom', name: '自定义食物', kcalPer100g: 0 },
]

// MET（代谢当量）估算：MET × 3.5 × 体重(kg) ÷ 200 × 运动分钟。
export const EXERCISE_LIBRARY = [
  { id: 'rest', name: '休息日', met: 0 },
  { id: 'walk', name: '散步', met: 3.5 },
  { id: 'brisk_walk', name: '快走', met: 5 },
  { id: 'jog', name: '慢跑', met: 7 },
  { id: 'run', name: '跑步', met: 9.8 },
  { id: 'treadmill', name: '跑步机', mode: 'treadmill' },
  { id: 'cycling', name: '骑行 / 动感单车', met: 7.5 },
  { id: 'swimming', name: '游泳', met: 8 },
  { id: 'jump_rope', name: '跳绳', met: 11.8 },
  { id: 'yoga', name: '瑜伽', met: 2.5 },
  { id: 'pilates', name: '普拉提', met: 3 },
  { id: 'strength', name: '力量训练', met: 6 },
  { id: 'hiit', name: 'HIIT', met: 8.5 },
  { id: 'badminton', name: '羽毛球', met: 5.5 },
  { id: 'basketball', name: '篮球', met: 6.5 },
  { id: 'hiking', name: '徒步', met: 6 },
  { id: 'dance', name: '健身操 / 舞蹈', met: 5 },
]

export const calculateFoodCalories = (foodId, grams, customKcalPer100g = 0) => {
  const food = FOOD_LIBRARY.find((item) => item.id === foodId)
  const kcalPer100g = foodId === 'custom' ? Number(customKcalPer100g) || 0 : food?.kcalPer100g || 0
  return Math.round((kcalPer100g * (Number(grams) || 0)) / 100)
}

export const calculateExerciseCalories = (exerciseId, weight, duration, params = {}) => {
  const exercise = EXERCISE_LIBRARY.find((item) => item.id === exerciseId)
  if (!exercise) return 0
  if (exercise.mode === 'treadmill') {
    return calculateTreadmillCalories(weight, params.speed, params.incline, duration)
  }
  return Math.round((exercise.met * 3.5 * (Number(weight) || 0) * (Number(duration) || 0)) / 200)
}

// 跑步机卡路里估算：采用 ACSM 步行/跑步代谢当量公式
// 速度(km/h)、坡度(%)、时长(分钟) → VO2(ml/kg/min) × 体重(kg) ÷ 200 × 分钟
export function calculateTreadmillCalories(weight, speedKmh, inclinePercent, duration) {
  const weightKg = Number(weight) || 0
  const speed = Number(speedKmh) || 0
  const grade = Math.max(0, Number(inclinePercent) || 0) / 100
  const minutes = Number(duration) || 0
  if (!weightKg || !speed || !minutes) return 0

  const metersPerMinute = speed * (1000 / 60)
  // 速度 ≤6 km/h 按步行，>6 km/h 按跑步
  const vo2 = speed <= 6
    ? 0.1 * metersPerMinute + 1.8 * metersPerMinute * grade + 3.5
    : 0.2 * metersPerMinute + 0.9 * metersPerMinute * grade + 3.5

  return Math.round((vo2 * weightKg * minutes) / 200)
}

const meals = {
  lin: [
    [
      { type: '早餐', name: '燕麦拿铁 · 水煮蛋', calories: 348 },
      { type: '午餐', name: '香煎鸡胸藜麦碗', calories: 526 },
      { type: '晚餐', name: '番茄虾仁荞麦面', calories: 438 },
      { type: '加餐', name: '无糖酸奶 · 蓝莓', calories: 126 },
    ],
    [
      { type: '早餐', name: '牛油果全麦吐司', calories: 365 },
      { type: '午餐', name: '牛肉时蔬糙米饭', calories: 548 },
      { type: '晚餐', name: '南瓜豆腐暖沙拉', calories: 397 },
      { type: '加餐', name: '奇异果', calories: 82 },
    ],
    [
      { type: '早餐', name: '希腊酸奶坚果杯', calories: 318 },
      { type: '午餐', name: '照烧鸡肉能量碗', calories: 572 },
      { type: '晚餐', name: '菌菇豆腐汤', calories: 356 },
      { type: '加餐', name: '香蕉', calories: 105 },
    ],
  ],
  zhou: [
    [
      { type: '早餐', name: '全麦贝果 · 黑咖啡', calories: 422 },
      { type: '午餐', name: '黑椒牛肉杂粮饭', calories: 684 },
      { type: '晚餐', name: '清蒸鲈鱼 · 时蔬', calories: 535 },
      { type: '加餐', name: '蛋白奶昔', calories: 172 },
    ],
    [
      { type: '早餐', name: '鸡蛋火腿三明治', calories: 458 },
      { type: '午餐', name: '鸡腿肉咖喱饭', calories: 735 },
      { type: '晚餐', name: '金枪鱼意面沙拉', calories: 542 },
      { type: '加餐', name: '苹果 · 杏仁', calories: 188 },
    ],
    [
      { type: '早餐', name: '燕麦蛋白松饼', calories: 408 },
      { type: '午餐', name: '鲜虾鸡肉双拼饭', calories: 692 },
      { type: '晚餐', name: '牛肉豆腐煲', calories: 568 },
      { type: '加餐', name: '低脂牛奶', calories: 135 },
    ],
  ],
}

export function createSeedRecords(today = new Date()) {
  const linTotals = [1528, 1392, 1486, 1421, 1664, 1378, 1438]
  const zhouTotals = [1812, 1923, 1768, 1876, 2035, 1796, 1813]
  const linWeights = [56.8, 56.7, 56.6, 56.5, 56.6, 56.4, 56.3]
  const zhouWeights = [74.9, 74.8, 74.7, 74.6, 74.7, 74.5, 74.4]
  const exercises = [
    ['快走', 42, 268],
    ['力量训练', 35, 235],
    ['慢跑', 38, 326],
    ['瑜伽', 45, 168],
    ['动感单车', 40, 352],
    ['休息日', 0, 0],
    ['户外慢跑', 46, 384],
  ]

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6)
    const mealIndex = index % 3
    const linMealSet = meals.lin[mealIndex].map((item) => ({ ...item }))
    const zhouMealSet = meals.zhou[mealIndex].map((item) => ({ ...item }))

    if (index === 6) {
      return [
        {
          id: `seed-lin-${index}`,
          profileId: 'lin',
          date: toDateKey(date),
          time: '20:36',
          calories: 1438,
          weight: linWeights[index],
          exercise: '普拉提',
          duration: 48,
          burned: 286,
          water: 1800,
          mood: '轻盈',
          meals: meals.lin[0].map((item) => ({ ...item })),
        },
        {
          id: `seed-zhou-${index}`,
          profileId: 'zhou',
          date: toDateKey(date),
          time: '21:08',
          calories: 1813,
          weight: zhouWeights[index],
          exercise: '力量训练',
          duration: 52,
          burned: 418,
          water: 2400,
          mood: '很有劲',
          meals: meals.zhou[0].map((item) => ({ ...item })),
        },
      ]
    }

    const linScale = linTotals[index] / linMealSet.reduce((sum, item) => sum + item.calories, 0)
    const zhouScale = zhouTotals[index] / zhouMealSet.reduce((sum, item) => sum + item.calories, 0)
    linMealSet.forEach((item) => { item.calories = Math.round(item.calories * linScale) })
    zhouMealSet.forEach((item) => { item.calories = Math.round(item.calories * zhouScale) })

    return [
      {
        id: `seed-lin-${index}`,
        profileId: 'lin',
        date: toDateKey(date),
        time: '20:30',
        calories: linTotals[index],
        weight: linWeights[index],
        exercise: exercises[index][0],
        duration: exercises[index][1],
        burned: exercises[index][2],
        water: 1800,
        mood: '不错',
        meals: linMealSet,
      },
      {
        id: `seed-zhou-${index}`,
        profileId: 'zhou',
        date: toDateKey(date),
        time: '21:10',
        calories: zhouTotals[index],
        weight: zhouWeights[index],
        exercise: index % 2 ? '力量训练' : '户外慢跑',
        duration: exercises[index][1] + 8,
        burned: exercises[index][2] + (exercises[index][2] ? 92 : 0),
        water: 2400,
        mood: '有能量',
        meals: zhouMealSet,
      },
    ]
  }).flat()
}

export const NAV_ITEMS = [
  { id: 'overview', label: '今日概览' },
  { id: 'checkin', label: '双人打卡' },
  { id: 'trend', label: '热量趋势' },
  { id: 'meals', label: '饮食记录' },
  { id: 'summary', label: '数据汇总' },
]
