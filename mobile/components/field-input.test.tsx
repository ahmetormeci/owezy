import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FieldInput, StableTextInput } from "./field";

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
    await single.unmount();

    await render(
      <FieldInput value="" placeholder="Uzun bir ipucu" multiline onChangeText={() => {}} />,
    );
    expect(
      screen.getByText("Uzun bir ipucu", { includeHiddenElements: true }).props.numberOfLines,
    ).toBeUndefined();
  });
});

/**
 * BU BOLUM NEYI KORUYOR: hizli yazinca harf dusmesini (21 Ekim).
 *
 * Alan "kontrollu" iken her tus uygulamaya gidip value olarak telefona
 * GERI geliyordu; geri gelen eski deger telefonun o an yazdiginin ustune
 * yaziliyordu. Simulatorde "123456789"dan "12345" kaldi. Telefonun kendisi
 * burada yok - korunan sey, o yarisin hic kurulmamasi: deger telefona
 * yalnizca uygulamanin KENDISI degistirdiginde gidiyor.
 */
describe("StableTextInput", () => {
  function Echo() {
    const [text, setText] = useState("");
    return <StableTextInput testID="f" value={text} onChangeText={setText} />;
  }

  it("DEGER TELEFONA GERI GONDERILMIYOR - value yok, defaultValue var", async () => {
    await render(<StableTextInput testID="f" value="12" onChangeText={() => {}} />);

    // NEGATIF KONTROL: value dolu olsaydi alan yine kontrollu olurdu ve
    // yaris geri gelirdi.
    expect(screen.getByTestId("f").props.value).toBeUndefined();
    expect(screen.getByTestId("f").props.defaultValue).toBe("12");
  });

  it("YAZILAN GERI GELINCE alan yeniden kurulmuyor", async () => {
    await render(<Echo />);
    const before = screen.getByTestId("f");

    await fireEvent.changeText(before, "123");

    // Ayni ornek: yazarken alan sokulup takilsaydi klavye kapanip acilirdi.
    expect(screen.getByTestId("f")).toBe(before);
    expect(screen.getByTestId("f")).toHaveDisplayValue("123");
  });

  it("UYGULAMA DEGISTIRINCE yeni deger gorunuyor - fis tutari, kalem toplami", async () => {
    const view = await render(<StableTextInput testID="f" value="" onChangeText={() => {}} />);

    await view.rerender(<StableTextInput testID="f" value="42" onChangeText={() => {}} />);

    expect(screen.getByTestId("f")).toHaveDisplayValue("42");
  });

  it("ESKI DEGERE DONUS de gorunuyor - prop degismese bile", async () => {
    // Bos baslayan alana yazildi, sonra uygulama onu yine bosaltti
    // (gonderilen yorum). defaultValue "" -> "" degismedigi icin bu ancak
    // alani yeniden kurarak telefona ulasiyor.
    const view = await render(<StableTextInput testID="f" value="" onChangeText={() => {}} />);
    await fireEvent.changeText(screen.getByTestId("f"), "5");
    await view.rerender(<StableTextInput testID="f" value="5" onChangeText={() => {}} />);

    await view.rerender(<StableTextInput testID="f" value="" onChangeText={() => {}} />);

    expect(screen.getByTestId("f")).toHaveDisplayValue("");
  });
});
