import { render, screen } from "@testing-library/react-native";
import { Image } from "react-native";
import { MemberAvatar } from "./receipt";

/**
 * BU DOSYA NEYI KORUYOR: avatarin BAS HARFE DUSEBILMESINI (ADR-054).
 *
 * GERCEKTEN YASANDI (10 Eylul): fotograf destegi eklenirken MemberAvatar
 * useSession() cagirmaya basladi ve useSession, <SessionProvider> disinda
 * BILEREK FIRLATIYOR. Bir anda fotografi OLMAYAN birinin bas harflerini
 * cizmek bile oturum gerektirdi; iki ekran testi aninda dustu. Kusur
 * testlerde degildi - MemberAvatar sunum bileseni ve her yerde kullaniliyor.
 *
 * Cozum useOptionalSession: oturum yoksa null, firlatma yok. Bu dosya o
 * kurali sabitliyor - taklit KURULMADAN render ediliyor, yani saglayici
 * gercekten yok.
 */

describe("MemberAvatar", () => {
  it("OTURUM YOKKEN bile ciziliyor - bas harfe dusuyor", async () => {
    // Hicbir SessionProvider yok ve hicbir taklit kurulmadi. Eskiden burasi
    // "useSession, <SessionProvider> disinda cagrildi" diye patliyordu.
    await render(<MemberAvatar name="Deniz Yilmaz" />);

    expect(screen.getByText("DE")).toBeTruthy();
  });

  it("fotografi olsa BILE belirtec yoksa bas harf ciziliyor", async () => {
    // Belirtecsiz bir <Image> 401 alir ve RN o adresi BASARISIZ diye
    // onbellekleyebilir - hic denememek dogru davranis.
    await render(
      <MemberAvatar name="Selin" avatarUrl="/api/v1/users/u2/avatar?v=1" hasImage />,
    );

    expect(screen.getByText("SE")).toBeTruthy();
    expect(screen.queryAllByTestId("avatar-image")).toHaveLength(0);
  });

  it("bas harfler TURKCE buyutuluyor", async () => {
    // toLocaleUpperCase olmasaydi "i" -> "I" olurdu, "İ" degil.
    await render(<MemberAvatar name="irem" />);

    expect(screen.getByText("İR")).toBeTruthy();
  });
});

/**
 * Image'in gercekten ciziligini ayri sinamiyoruz: belirteci vermek
 * SessionProvider'i ve secure store'u kurmayi gerektirir, ki o zaman test
 * MemberAvatar'i degil oturum altyapisini sinamis olur. Fotografin gercekten
 * cizildigi yer E2E - orada tarayici baytlari cozuyor (e2e/avatar.spec.ts).
 */
void Image;
