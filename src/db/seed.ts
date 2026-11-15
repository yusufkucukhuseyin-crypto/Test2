import { db } from './db'
import { ensureSettings } from './actions'
import type { Customer, Order, OrderImage, Payment, StockItem, StockMove } from './types'
import { shiftDay, today, uid } from '../lib/format'
import { calcTotal, productTypeOf } from '../lib/domain'

/** Örnek görsel: basit bir pasta çizimi */
async function drawCake(color: string, tiers: number, bg: string): Promise<{ blob: Blob; thumb: Blob }> {
  const make = (size: number) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    const s = size / 400
    g.fillStyle = bg
    g.fillRect(0, 0, size, size)
    g.fillStyle = 'rgba(0,0,0,0.06)'
    g.beginPath()
    g.ellipse(200 * s, 340 * s, 150 * s, 18 * s, 0, 0, Math.PI * 2)
    g.fill()
    let y = 330
    for (let i = 0; i < tiers; i++) {
      const w = 260 - i * 60
      const h = 80 - i * 6
      g.fillStyle = color
      g.beginPath()
      g.roundRect((200 - w / 2) * s, (y - h) * s, w * s, h * s, 10 * s)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.55)'
      for (let x = 200 - w / 2 + 12; x < 200 + w / 2 - 6; x += 18) {
        g.beginPath()
        g.arc(x * s, (y - h + 4) * s, 7 * s, 0, Math.PI)
        g.fill()
      }
      y -= h
    }
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(200 * s, (y - 14) * s, 14 * s, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#d14d5e'
    g.beginPath()
    g.arc(200 * s, (y - 14) * s, 8 * s, 0, Math.PI * 2)
    g.fill()
    return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85))
  }
  return { blob: await make(800), thumb: await make(400) }
}

export async function loadDemoData() {
  const settings = await ensureSettings()
  const t = today()
  const now = Date.now()

  const mk = (c: Partial<Customer> & { name: string; phone: string }): Customer => ({
    id: uid(),
    specialDays: [],
    createdAt: now,
    updatedAt: now,
    ...c,
  })
  const soon = (d: number) => {
    const x = new Date()
    x.setDate(x.getDate() + d)
    return { month: x.getMonth() + 1, day: x.getDate() }
  }

  const customers: Customer[] = [
    mk({
      name: 'Ayşe Yılmaz',
      phone: '0532 111 22 33',
      instagram: 'ayse.yilmaz',
      source: 'Instagram',
      specialDays: [{ id: uid(), type: 'Doğum günü', person: 'Kızı Elif', ...soon(8), year: 2021 }],
    }),
    mk({
      name: 'Mehmet Kaya',
      phone: '0533 444 55 66',
      source: 'WhatsApp',
      specialDays: [{ id: uid(), type: 'Evlilik yıl dönümü', person: 'Kendisi', ...soon(19), year: 2016 }],
    }),
    mk({
      name: 'Zeynep Demir',
      phone: '0544 777 88 99',
      source: 'Torunlar Tavsiye',
      allergies: 'Fındık alerjisi',
      specialDays: [{ id: uid(), type: 'Doğum günü', person: 'Oğlu Can', ...soon(3), year: 2020 }],
    }),
    // Numarası bilinmeyen, WhatsApp kullanıcı adıyla yazan müşteri
    mk({ name: 'Elif Şahin', phone: '', whatsapp: 'elif.sahin', instagram: 'elifsahin', source: 'Instagram' }),
    mk({ name: 'Burak Çelik', phone: '0212 555 66 77', source: 'Telefon', notes: 'Kurumsal siparişler, fatura istemiyor.' }),
    mk({
      name: 'Selin Arslan',
      phone: '0538 999 00 11',
      source: 'Eski müşteri',
      specialDays: [{ id: uid(), type: 'Doğum günü', person: 'Kendisi', month: 1, day: 15 }],
    }),
  ]

  type Spec = {
    c: number
    pt: string
    d: number
    amount: number
    status: Order['status']
    tiers?: number
    occasion?: string
    cake?: string
    cream?: string
    fill?: string
    text?: string
    card?: string
    design?: string
    deposit?: number
    paid?: boolean
    extras?: [string, number][]
    img?: [string, number]
  }
  const specs: Spec[] = [
    { c: 0, pt: 'pasta', d: -160, amount: 15, status: 'teslim', tiers: 1, occasion: 'Doğum günü', paid: true, img: ['#f4c2c9', 1] },
    { c: 1, pt: 'pasta', d: -130, amount: 25, status: 'teslim', tiers: 2, occasion: 'Yıl dönümü', paid: true, img: ['#e9d8c4', 2] },
    { c: 3, pt: 'cupcake', d: -110, amount: 24, status: 'teslim', occasion: 'Baby shower', paid: true },
    { c: 4, pt: 'kurabiye', d: -95, amount: 60, status: 'teslim', occasion: 'Kurumsal', paid: true },
    { c: 2, pt: 'pasta', d: -80, amount: 20, status: 'teslim', tiers: 2, occasion: 'Doğum günü', paid: true, img: ['#bcd7e8', 2] },
    { c: 5, pt: 'cupcake', d: -62, amount: 12, status: 'teslim', paid: true },
    { c: 0, pt: 'kurabiye', d: -45, amount: 30, status: 'teslim', occasion: 'Doğum günü', paid: true },
    { c: 1, pt: 'pasta', d: -30, amount: 40, status: 'teslim', tiers: 3, occasion: 'Nişan', paid: true, img: ['#f7efe6', 3] },
    { c: 4, pt: 'cupcake', d: -21, amount: 36, status: 'teslim', occasion: 'Kurumsal', paid: true },
    { c: 3, pt: 'pasta', d: -12, amount: 18, status: 'teslim', tiers: 1, occasion: 'Doğum günü', paid: true, img: ['#d9c8ef', 1] },
    { c: 5, pt: 'pasta', d: -4, amount: 12, status: 'teslim', tiers: 1, deposit: 1000 },
    {
      c: 2, pt: 'pasta', d: 0, amount: 20, status: 'onaylandi', tiers: 2, occasion: 'Doğum günü',
      cake: 'Vanilya', cream: 'Vanilyalı', fill: 'Çilek, Muz', text: 'İyi ki doğdun Can', card: 'Nice mutlu yaşlara Can! Sevgilerle, annen ve baban',
      design: 'Mavi tonlarında, üstünde araba figürü. Fındık kullanılmayacak!', deposit: 2000,
      extras: [['Şeker hamuru figür', 600]],
    },
    {
      c: 0, pt: 'pasta', d: 1, amount: 15, status: 'onaylandi', tiers: 1, occasion: 'Doğum günü',
      cake: 'Kakao', cream: 'Çikolatalı', fill: 'Muz, Damla Çikolata', text: 'Elif 5 yaşında',
      design: 'Pembe-lila pastel, kelebekli. Referans fotoğraf WhatsApp’tan geldi.', deposit: 1500,
    },
    { c: 4, pt: 'kurabiye', d: 2, amount: 80, status: 'onaylandi', occasion: 'Kurumsal', design: 'Logolu kurabiye, tek tek paketli.', deposit: 3000 },
    {
      c: 1, pt: 'pasta', d: 3, amount: 30, status: 'onaylandi', tiers: 2, occasion: 'Yıl dönümü',
      cake: 'Kakao', cream: 'Vanilyalı', fill: 'Frambuaz', text: '10. yılımız', card: 'Nice yıllara sevgilim',
      design: 'Beyaz zemin, taze çiçek.', deposit: 4000, extras: [['Taze çiçek', 750]],
    },
    { c: 3, pt: 'cupcake', d: 3, amount: 24, status: 'onaylandi', occasion: 'Doğum günü' },
    {
      c: 5, pt: 'pasta', d: 6, amount: 50, status: 'onaylandi', tiers: 3, occasion: 'Düğün',
      cake: 'Vanilya', cream: 'Vanilyalı', fill: 'Orman Meyveli, Antep Fıstığı',
      design: 'Üç katlı beyaz, altın varaklı.', deposit: 8000, extras: [['Altın varak', 1200]],
    },
    { c: 2, pt: 'kurabiye', d: 6, amount: 20, status: 'onaylandi', occasion: 'Doğum günü' },
    { c: 0, pt: 'pasta', d: 10, amount: 20, status: 'onaylandi', tiers: 2, occasion: 'Baby shower' },
    { c: 3, pt: 'pasta', d: 13, amount: 25, status: 'onaylandi', tiers: 2, occasion: 'Söz' },
  ]

  const orders: Order[] = []
  const payments: Payment[] = []
  const images: OrderImage[] = []
  let no = settings.nextOrderNo
  for (const s of specs) {
    const pt = productTypeOf(settings, s.pt)
    const extras = (s.extras ?? []).map(([label, amount]) => ({ id: uid(), label, amount }))
    const deliveryFee = s.d === 6 ? 500 : 0
    const total = calcTotal({ unitPrice: pt.unitPrice, amount: s.amount, extras, deliveryFee })
    const agreed = Math.round(total / 50) * 50
    const deliveryDate = shiftDay(t, s.d)
    const o: Order = {
      id: uid(),
      no: no++,
      customerId: customers[s.c].id,
      productType: s.pt,
      occasion: s.occasion,
      amount: s.amount,
      tiers: s.tiers,
      cakeType: s.cake,
      creamType: s.cream,
      filling: s.fill,
      cakeText: s.text,
      cardText: s.card,
      designNotes: s.design,
      deliveryDate,
      deliveryTime: s.d % 2 === 0 ? '14:00' : '11:30',
      deliveryMethod: s.d === 6 ? 'adres' : 'gelal',
      deliveryAddress: s.d === 6 ? 'Bağdat Cad. No: 120, Kadıköy' : undefined,
      unitPrice: pt.unitPrice,
      extras,
      deliveryFee,
      calculatedTotal: total,
      agreedPrice: agreed,
      status: s.status,
      createdAt: now - (30 - s.d) * 86400000,
      updatedAt: now,
    }
    orders.push(o)
    const dep = s.deposit ?? (s.paid ? Math.round(agreed * 0.3) : 0)
    if (dep) {
      payments.push({ id: uid(), orderId: o.id, kind: 'kapora', amount: dep, method: 'Havale/EFT', date: shiftDay(deliveryDate, -10), createdAt: now })
    }
    if (s.paid) {
      payments.push({ id: uid(), orderId: o.id, kind: 'odeme', amount: agreed - dep, method: 'Nakit', date: deliveryDate, createdAt: now })
    }
    if (s.img) {
      const pic = await drawCake(pt.color, s.img[1], s.img[0])
      images.push({
        id: uid(),
        orderId: o.id,
        kind: 'final',
        ...pic,
        caption: `${s.occasion ?? ''} ${pt.label.toLocaleLowerCase('tr-TR')}`.trim(),
        inCatalog: 1,
        productType: s.pt,
        createdAt: now - (30 - s.d) * 86400000,
      })
    }
  }

  const sItem = (name: string, category: string, unit: string, quantity: number, unitCost: number, minQuantity: number): StockItem => ({
    id: uid(), name, category, unit, quantity, unitCost, minQuantity, createdAt: now, updatedAt: now,
  })
  const stock: StockItem[] = [
    sItem('Un', 'Un ve şeker', 'kg', 12, 32, 5),
    sItem('Toz şeker', 'Un ve şeker', 'kg', 8, 45, 5),
    sItem('Pudra şekeri', 'Un ve şeker', 'kg', 2, 70, 3),
    sItem('Tereyağı', 'Süt ürünleri', 'kg', 4, 420, 2),
    sItem('Mascarpone', 'Süt ürünleri', 'kg', 1.5, 520, 2),
    sItem('Krema (sıvı)', 'Süt ürünleri', 'lt', 6, 110, 3),
    sItem('Bitter çikolata', 'Çikolata', 'kg', 3, 650, 1),
    sItem('Beyaz çikolata', 'Çikolata', 'kg', 0.8, 700, 1),
    sItem('Çilek', 'Meyve', 'kg', 2, 160, 1),
    sItem('Şeker hamuru', 'Süsleme', 'kg', 2.5, 280, 1),
    sItem('Pasta kutusu (24 cm)', 'Ambalaj', 'adet', 14, 35, 10),
    sItem('Cupcake kapsülü', 'Ambalaj', 'adet', 200, 1.5, 50),
  ]
  const moves: StockMove[] = stock.map((s) => ({
    id: uid(), itemId: s.id, type: 'giris', quantity: s.quantity, unitCost: s.unitCost, date: shiftDay(t, -20), note: 'Açılış stoğu', createdAt: now,
  }))

  await db.transaction('rw', [db.customers, db.orders, db.payments, db.images, db.stockItems, db.stockMoves, db.settings], async () => {
    await db.customers.bulkAdd(customers)
    await db.orders.bulkAdd(orders)
    await db.payments.bulkAdd(payments)
    await db.images.bulkAdd(images)
    await db.stockItems.bulkAdd(stock)
    await db.stockMoves.bulkAdd(moves)
    await db.settings.update('main', { nextOrderNo: no })
  })
}
