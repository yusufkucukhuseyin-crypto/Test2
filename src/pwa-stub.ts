// Tek dosyalık önizleme sürümünde servis çalışanı yok; "virtual:pwa-register" yerine bu boş modül kullanılır.
export function registerSW(_opts?: unknown): (reload?: boolean) => Promise<void> {
  return async () => {}
}
