import path from "node:path";

// Uc test kullanicisi: yetki ve cok kisili bolusum senaryolari icin gerekli.
// Sifreler .env.local'den okunuyor, koda hicbir zaman yazilmiyor.
//
// DEGISKEN ADLARINDAN "CLERK" CIKTI (Faz 25.8). Bu kullanicilar artik bir
// kimlik saglayicisinda DEGIL, E2E veritabanimizda duruyor ve her kosuda
// global.setup.ts tarafindan yeniden yaratiliyor. Adin degismesi kozmetik
// degil: "E2E_CLERK_USER_1_EMAIL" okuyan biri, degeri Clerk panelinde
// aramaya giderdi ve orada bulamayacakti.
export type E2EUser = {
  key: "owner" | "member" | "outsider";
  email: string;
  password: string;
  /**
   * Gorunen ad. Kullaniciyi ARTIK BIZ yaratiyoruz (global.setup.ts), yani
   * bu alan da bizim. Onceden Clerk panelindeki profil bilgisinden geliyordu
   * ve testler onu degistiremiyordu.
   *
   * HICBIR TEST BU DEGERI SABIT YAZMIYOR ve yazmamali: expenses.spec.ts
   * katilimci kutusunun etiketini sayfanin kendisinden okuyor. Bir zamanlar
   * e-postayi sabit yaziyordu ve Clerk hesabina bir ad girildigi gun sessizce
   * kirildi. Burasi yalnizca kurulumun ne yazacagini soyluyor.
   */
  displayName: string;
  storageStatePath: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} tanimli degil. .env.local dosyasini kontrol edin.`);
  }
  return value;
}

const authDir = path.join(process.cwd(), "e2e", ".auth");

export const E2E_USERS: E2EUser[] = [
  {
    key: "owner",
    email: requireEnv("E2E_USER_1_EMAIL"),
    password: requireEnv("E2E_USER_1_PASSWORD"),
    displayName: "testuser1",
    storageStatePath: path.join(authDir, "owner.json"),
  },
  {
    key: "member",
    email: requireEnv("E2E_USER_2_EMAIL"),
    password: requireEnv("E2E_USER_2_PASSWORD"),
    displayName: "testuser2",
    storageStatePath: path.join(authDir, "member.json"),
  },
  {
    key: "outsider",
    email: requireEnv("E2E_USER_3_EMAIL"),
    password: requireEnv("E2E_USER_3_PASSWORD"),
    displayName: "testuser3",
    storageStatePath: path.join(authDir, "outsider.json"),
  },
];

export function userByKey(key: E2EUser["key"]): E2EUser {
  const user = E2E_USERS.find((candidate) => candidate.key === key);
  if (!user) {
    throw new Error(`Bilinmeyen test kullanicisi: ${key}`);
  }
  return user;
}
