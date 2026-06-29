import type { RawRow } from './excel-parser'
import type { ColumnMeta } from './column-analyzer'

// Minimal ViewConfig fields needed for viewer message generation
interface ViewerMsgConfig {
  titleColumn: string
  subtitleColumn: string
  badgeColumn: string
  msgPriceCol?: string
  msgAreaCol?: string
  msgPlansCol?: string
}

export function colEmoji(col: ColumnMeta): string {
  const l = (col.key + ' ' + col.label).toLowerCase()
  if (/price|value|cost|amount|total|nominal|سعر/.test(l)) return '💰'
  if (/area|sqm|m²|bua|size|مساحة|built/.test(l)) return '📐'
  if (/bed|room|غرف|studio/.test(l)) return '🛏️'
  if (/floor|الدور/.test(l)) return '🏢'
  if (/discount|خصم/.test(l)) return '💸'
  if (/finish|تشطيب/.test(l)) return '🎨'
  if (/parking|موقف/.test(l)) return '🚗'
  if (/maint|صيانة/.test(l)) return '🔧'
  if (/phase|building|block|مرحلة|مبنى/.test(l)) return '🏗️'
  if (/delivery|تسليم/.test(l) || col.type === 'year') return '📅'
  if (/garden|حديقة/.test(l)) return '🌿'
  if (/roof|روف/.test(l)) return '🏠'
  if (/developer|مطور/.test(l)) return '🏗️'
  if (/project|مشروع/.test(l)) return '🏘️'
  if (/city|location|مدينة/.test(l)) return '📍'
  if (/type|unit|نوع/.test(l)) return '🏷️'
  if (/code|unit.?no|كود/.test(l)) return '#️⃣'
  if (col.type === 'numeric') return '📊'
  return '🏷️'
}

export function generateViewerMessage(
  row: RawRow,
  columns: ColumnMeta[],
  viewConfig: ViewerMsgConfig,
  selectedColKeys: string[],
): string {
  const colMap = Object.fromEntries(columns.map(c => [c.key, c]))
  const lines: string[] = []

  // Auto-detect plans column if not explicitly mapped
  const plansKey = viewConfig.msgPlansCol
    ?? columns.find(c => /plan|payment|خطة|دفع/i.test(c.key + ' ' + c.label))?.key

  // Header: title value
  const titleVal = viewConfig.titleColumn ? String(row[viewConfig.titleColumn] ?? '').trim() : ''
  if (titleVal) {
    lines.push(`🏢 ${titleVal} 🔥`)
    lines.push('')
  }

  // Location: subtitle
  const subVal = viewConfig.subtitleColumn ? String(row[viewConfig.subtitleColumn] ?? '').trim() : ''
  if (subVal && subVal !== '—') lines.push(`📍 ${subVal}`)

  // Status/type: badge
  const badgeVal = viewConfig.badgeColumn ? String(row[viewConfig.badgeColumn] ?? '').trim() : ''
  if (badgeVal && badgeVal !== '—') lines.push(`🏷️ الحالة: ${badgeVal}`)

  // Collect body keys: skip header cols and plans
  const skipKeys = new Set([
    viewConfig.titleColumn,
    viewConfig.subtitleColumn,
    viewConfig.badgeColumn,
    plansKey,
  ].filter((k): k is string => Boolean(k)))

  const bodyKeys = selectedColKeys.filter(k => !skipKeys.has(k))

  // Auto-detect price and area columns for ordering (price last, just before plans)
  const priceKey = viewConfig.msgPriceCol
    ?? bodyKeys.find(k => {
      const c = colMap[k]
      return c?.type === 'numeric' && /price|value|cost|amount|total|nominal|سعر/i.test(c.key + ' ' + c.label)
    })

  const nonPriceKeys = bodyKeys.filter(k => k !== priceKey)
  const orderedKeys = [...nonPriceKeys, ...(priceKey ? [priceKey] : [])]

  if (orderedKeys.length > 0 || (plansKey && selectedColKeys.includes(plansKey))) {
    lines.push('')
  }

  for (const key of orderedKeys) {
    const col = colMap[key]
    if (!col) continue
    const val = row[key]
    if (val == null || val === '' || String(val) === '—') continue
    const emoji = colEmoji(col)
    const display = col.type === 'numeric' ? fmtPrice(val) : String(val)
    lines.push(`${emoji} ${col.label}: ${display}`)
  }

  // Payment plans section
  if (plansKey && selectedColKeys.includes(plansKey)) {
    const plansStr = String(row[plansKey] ?? '')
    const plans = plansStr.split('|').map(s => s.trim()).filter(Boolean)
    if (plans.length > 0) {
      lines.push('')
      lines.push('✅ أنظمة السداد:')
      plans.forEach(p => lines.push(`• ${p}`))
    }
  }

  return lines.join('\n')
}

type PropertyInput = {
  city: string
  project: string
  developer: string
  type: string
  beds: number | string
  area: number | string
  garden: string | number
  roof: string | number
  finish: string
  price: number | string
  discount: number | string
  delivery: string
  maint: number | string
  plans: string
  code?: string
  phase?: string
  floor?: string | number
  parking?: string | number
}

type MessageFields = Partial<Record<
  'code' | 'phase' | 'floor' | 'area' | 'price' | 'discount' | 'delivery' | 'maint' | 'parking',
  boolean
>>

function bedsAr(beds: string | number): string {
  const b = parseInt(String(beds))
  if (isNaN(b) || b === 0) return 'استوديو'
  if (b === 1) return 'أوضة نوم'
  if (b === 2) return 'أوضتين'
  if (b === 3) return '3 أوض نوم'
  if (b === 4) return '4 أوض نوم'
  return `${b}+ أوض نوم`
}

function typeAr(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('standalone')) return 'فيلا مستقلة'
  if (t.includes('townhouse corner')) return 'تاون هاوس كورنر'
  if (t.includes('townhouse middle')) return 'تاون هاوس ميدل'
  if (t.includes('townhouse') || t.includes('town house')) return 'تاون هاوس'
  if (t.includes('twin')) return 'تون هاوس'
  if (t.includes('villa')) return 'فيلا'
  if (t.includes('penthouse')) return 'بنت هاوس'
  if (t.includes('duplex')) return 'دوبلكس'
  if (t.includes('studio')) return 'استوديو'
  if (t.includes('chalet')) return 'شاليه'
  if (t.includes('beach')) return 'شاليه شاطئي'
  if (t.includes('cabin')) return 'كابينة'
  if (t.includes('loft')) return 'لوفت'
  if (t.includes('palace')) return 'قصر'
  if (t.includes('apartment') || t.includes('condo')) return 'شقة'
  return type || 'وحدة'
}

function typeEmoji(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('villa') || t.includes('standalone') || t.includes('palace')) return '🏡'
  if (t.includes('chalet') || t.includes('beach') || t.includes('cabin')) return '🏖️'
  if (t.includes('penthouse') || t.includes('sky')) return '🌟'
  if (t.includes('duplex')) return '🏙️'
  if (t.includes('town') || t.includes('twin')) return '🏘️'
  return '🏢'
}

function finishAr(finish: string): string {
  const f = (finish || '').toLowerCase()
  if (f.includes('fully finished with ac and kitchen')) return 'متشطبة بالكامل مع تكييفات ومطبخ'
  if (f.includes('fully furnished with ac')) return 'مفروشة بالكامل مع تكييفات'
  if (f.includes('fully furnished')) return 'مفروشة بالكامل'
  if (f.includes('fully finished with ac')) return 'متشطبة بالكامل مع تكييفات'
  if (f.includes('fully finished with kitchen')) return 'متشطبة بالكامل مع مطبخ'
  if (f.includes('fully finished')) return 'متشطبة بالكامل'
  if (f.includes('semi')) return 'نص تشطيب'
  if (f.includes('core')) return 'كور آند شيل'
  if (f.includes('flexi')) return 'فليكسي'
  return finish || ''
}

function fmtPrice(n: string | number): string {
  const num = parseFloat(String(n))
  if (isNaN(num) || num <= 0) return '—'
  return num.toLocaleString('en-EG')
}

function cityCapitalize(s: string): string {
  if (!s) return ''
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export function generatePropertyMessage(
  r: PropertyInput,
  selectedPlans?: string[],
  fields?: MessageFields
): string {
  const isStudio =
    parseInt(String(r.beds)) === 0 ||
    String(r.type).toLowerCase().includes('studio')

  const typeStr = typeAr(r.type)
  const emoji = typeEmoji(r.type)
  const finishStr = finishAr(r.finish)
  const hasGarden = parseFloat(String(r.garden)) > 0
  const hasRoof = parseFloat(String(r.roof)) > 0
  const hasDiscount = parseFloat(String(r.discount)) > 0
  const hasMaint = parseFloat(String(r.maint)) > 0

  const unitDesc = isStudio
    ? `استوديو ${finishStr}`.trim()
    : `${bedsAr(r.beds)} ${finishStr}`.trim() + ` (${typeStr})`

  const lines: string[] = []

  lines.push(`${emoji} ${unitDesc} في ${r.project}! 🔥`)
  lines.push('')
  lines.push(`📍 ${cityCapitalize(r.city)}${r.developer ? ' | ' + r.developer : ''}`)

  if (fields?.code !== false && r.code) {
    lines.push(`🏷️ كود الوحدة: ${r.code}`)
  }

  if (fields?.phase !== false && r.phase) {
    lines.push(`🏗️ المرحلة / المبنى: ${r.phase}`)
  }

  if (fields?.floor !== false && r.floor !== '' && r.floor !== undefined && r.floor !== null) {
    lines.push(`🏢 الدور: ${r.floor}`)
  }

  if (fields?.area !== false && r.area) {
    let areaLine = `📐 المساحة: ${r.area} متر`
    if (hasGarden) areaLine += ` + ${r.garden} م حديقة`
    if (hasRoof) areaLine += ` + ${r.roof} م روف`
    lines.push(areaLine)
  }

  if (fields?.price !== false) {
    lines.push(`💰 السعر: ${fmtPrice(r.price)} جنيه`)
  }

  if (fields?.discount !== false && hasDiscount) {
    const discountNum = parseFloat(String(r.discount))
    lines.push(discountNum > 99 ? `💸 خصم كاش: ${fmtPrice(r.discount)} جنيه` : `💸 خصم كاش: ${r.discount}%`)
  }

  const plans = selectedPlans !== undefined
    ? selectedPlans
    : String(r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
  if (plans.length > 0) {
    lines.push('')
    lines.push('✅ أنظمة السداد:')
    plans.forEach(p => lines.push(`• ${p}`))
  }

  if (fields?.delivery !== false && r.delivery) {
    lines.push('')
    lines.push(`⏳ التسليم: ${r.delivery}`)
  }

  if (fields?.maint !== false && hasMaint) {
    lines.push(`🔧 صيانة: ${r.maint}%`)
  }

  if (fields?.parking !== false && r.parking && String(r.parking) !== '—') {
    lines.push(`🚗 موقف السيارة: ${r.parking}`)
  }

  return lines.join('\n')
}
