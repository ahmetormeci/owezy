import { render, screen } from "@testing-library/react-native";
import { FieldInput } from "./field";

/**
 * BU DOSYA NEYI KORUYOR: placeholder'in GORSELI ile ANLAMININ ayri
 * durmasini.
 *
 * GERCEKTEN YASANDI (11 Eylul): kullanici yayinlanmis 1.0.4'te Turkce
 * placeholder'i bozuk gordu - harfler birbirine girmisti. Ayni ekranda
 * Ingilizcesi ("Groceries") duzgun ciziliyordu. Metin, ceviri, font
 * kapsami, genislik ve renk TEK TEK olculup elendi; gelistirme
 * build'inde yeniden uretilemedi. Geriye kalan tek fark, yayinlanmis
 * build'in fontu yukleme yoluydu.
 *
 * Bu yuzden cizim iOS'tan ALINDI: placeholder artik bizim <Text>'imiz.
 *
 * ILK YAZIMDA BIR SEY KAYBEDILDI ve testler yakaladi: yerel placeholder
 * prop'u tamamen kaldirilinca hem getByPlaceholderText hem de ekran
 * okuyucunun okudugu ipucu gitti - dort ekran testi aninda dustu. Bu
 * yuzden yerel prop DURUYOR, yalnizca SEFFAF; anlam onda, cizim bizde.
 */
describe("FieldInput", () => {
  it("alan BOSKEN ipucu ciziliyor", async () => {
    await render(<FieldInput value="" placeholder="Market alışverişi" onChangeText={() => {}} />);

    /**
     * includeHiddenElements SART ve bu bir zorlama degil, ISPAT: metin
     * erisilebilirlik agacindan GIZLI oldugu icin varsayilan sorgu onu
     * bulamiyor. Yani "ekran okuyucu bunu okumuyor" iddiasi burada
     * kendiliginden dogrulaniyor.
     */
    expect(
      screen.getByText("Market alışverişi", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("DEGER VARKEN ipucu CIZILMIYOR - ust uste binme imkansiz", async () => {
    await render(
      <FieldInput value="Kahvaltı" placeholder="Market alışverişi" onChangeText={() => {}} />,
    );

    expect(
      screen.queryByText("Market alışverişi", { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("YEREL PLACEHOLDER DURUYOR - ekran okuyucu ve testler icin", async () => {
    // Gorunmez ama VAR: anlam gorselden ayri tasiniyor.
    await render(<FieldInput value="" placeholder="Market alışverişi" onChangeText={() => {}} />);

    expect(screen.getByPlaceholderText("Market alışverişi")).toBeTruthy();
  });

  it("ipucu EKRAN OKUYUCUDAN GIZLI - ayni cumle iki kez okunmasin", async () => {
    await render(<FieldInput value="" placeholder="Market alışverişi" onChangeText={() => {}} />);

    const hint = screen.getByText("Market alışverişi", { includeHiddenElements: true });
    expect(hint.props.accessibilityElementsHidden).toBe(true);
  });

  it("TEK SATIRDA kirpiliyor, COK SATIRDA serbest", async () => {
    const single = await render(
      <FieldInput value="" placeholder="Uzun bir ipucu" onChangeText={() => {}} />,
    );
    expect(
      screen.getByText("Uzun bir ipucu", { includeHiddenElements: true }).props.numberOfLines,
    ).toBe(1);
    single.unmount();

    await render(
      <FieldInput value="" placeholder="Uzun bir ipucu" multiline onChangeText={() => {}} />,
    );
    expect(
      screen.getByText("Uzun bir ipucu", { includeHiddenElements: true }).props.numberOfLines,
    ).toBeUndefined();
  });
});
