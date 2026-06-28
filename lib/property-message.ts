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
}

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

export function generatePropertyMessage(r: PropertyInput, selectedPlans?: string[]): string {
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

  let areaLine = `📐 المساحة: ${r.area} متر`
  if (hasGarden) areaLine += ` + ${r.garden} م حديقة`
  if (hasRoof) areaLine += ` + ${r.roof} م روف`
  lines.push(areaLine)

  lines.push(`💰 السعر: ${fmtPrice(r.price)} جنيه`)

  if (hasDiscount) {
    const discountNum = parseFloat(String(r.discount))
    lines.push(discountNum > 99 ? `💸 خصم كاش: ${fmtPrice(r.discount)} جنيه` : `💸 خصم كاش: ${r.discount}%`)
  }

  const plans = selectedPlans !== undefined
    ? selectedPlans
    : (r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
  if (plans.length > 0) {
    lines.push('')
    lines.push('✅ أنظمة السداد:')
    plans.forEach(p => lines.push(`• ${p}`))
  }

  if (r.delivery) {
    lines.push('')
    lines.push(`⏳ التسليم: ${r.delivery}`)
  }

  if (hasMaint) {
    lines.push(`🔧 صيانة: ${r.maint}%`)
  }

  return lines.join('\n')
}
