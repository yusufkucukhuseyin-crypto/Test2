import { saveFile } from '../db/backup'

/** Uygulamanın stil kurallarını (Tailwind) metin olarak toplar: kaydedilen dosya da aynı görünsün */
function collectCss(): string {
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      out.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'))
    } catch {
      /* başka kaynaktan gelen stil okunamaz */
    }
  }
  return out.join('\n')
}

/**
 * Yazdırılacak bölümü bağımsız bir HTML dosyası olarak kaydeder (önizlemede yazdırma penceresi açılmazsa).
 * Belge DOM ile kurulur; kodda sayfa etiketi metni tutulmaz.
 */
export async function saveNodeAsHtml(node: HTMLElement, title: string, filename: string, extraCss = '') {
  const doc = document.implementation.createHTMLDocument(title)
  doc.documentElement.lang = 'tr'
  const charset = doc.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  doc.head.prepend(charset)
  const vp = doc.createElement('meta')
  vp.name = 'viewport'
  vp.content = 'width=device-width,initial-scale=1'
  doc.head.append(vp)
  const style = doc.createElement('style')
  style.textContent = collectCss() + '\nbody{background:#fff;margin:0;padding:16px}@media print{body{padding:0}.no-print{display:none}}\n' + extraCss
  doc.head.append(style)
  const bar = doc.createElement('div')
  bar.className = 'no-print'
  bar.style.cssText = 'text-align:center;margin-bottom:12px'
  const btn = doc.createElement('button')
  btn.textContent = 'Yazdır'
  btn.setAttribute('onclick', 'window.print()')
  btn.style.cssText = 'padding:10px 18px;border-radius:12px;border:1px solid #ccc;background:#fff;font-size:15px'
  bar.append(btn)
  doc.body.append(bar, doc.importNode(node, true))
  const html = new XMLSerializer().serializeToString(doc.doctype!) + '\n' + doc.documentElement.outerHTML
  await saveFile(new Blob([html], { type: 'text/html' }), filename)
}
