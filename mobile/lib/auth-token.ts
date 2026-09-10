import { useEffect, useState } from "react";
import { useOptionalSession } from "./auth";

/**
 * Oturum belirtecini bir kez alip DURUMA koyar.
 *
 * NEDEN VAR: yetkili bir goruntu <Image source={{ headers }}> ile ciziliyor
 * ve baslik SENKRON bir deger istiyor - oysa getToken() bir soz donduruyor.
 * Bu kanca o kopruyu kuruyor.
 *
 * IPTAL BAYRAGI: ekran cevap gelmeden kapanabilir; onsuz artik gorunmeyen
 * bir bilesenin durumu guncellenmeye calisilir ve React uyari basardi.
 *
 * null = "henuz bilmiyoruz". Cagiran bu haldeyken gorsel cizmemeli: basliksiz
 * bir istek 401 doner ve tarayici/RN o adresi BASARISIZ diye onbellekleyebilir.
 */
export function useAuthToken(): string | null {
  /**
   * OPSIYONEL OTURUM, useSession DEGIL. Bu kancayi bir SUNUM bileseni
   * (MemberAvatar) cagiriyor ve o bilesen saglayicisiz da cizilebilmeli -
   * fotografi olmayan birinin bas harfleri icin oturum gerekmiyor.
   * useSession burada firlatirdi ve nitekim firlatti (iki ekran testi).
   */
  const session = useOptionalSession();
  const getToken = session?.getToken;
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken) return;
    let cancelled = false;
    void (async () => {
      const value = await getToken();
      if (!cancelled) setToken(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return token;
}
