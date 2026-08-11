import { expect, type Browser, type Page } from "@playwright/test";
import { trackContext } from "./fixtures";
import { userByKey, type E2EUser } from "./users";

// Testler ayni veritabanini paylastigi icin her test kendi grubunu benzersiz
// bir adla olusturuyor; boylece birbirlerinin verisini gormuyorlar.
export function uniqueGroupName(label: string): string {
  return `[e2e] ${label} ${Date.now()}`;
}

// Bir grup sayfasinin adresi: /groups/<uuid>. Bir islemin gercekten bitip
// gruba yonlendirdigimizi anlamak icin kullaniyoruz.
const GROUP_PAGE_URL = /\/groups\/[0-9a-f-]{36}$/;

export async function pageAs(browser: Browser, key: E2EUser["key"]): Promise<Page> {
  const user = userByKey(key);
  const context = await browser.newContext({ storageState: user.storageStatePath });
  trackContext(context);
  return context.newPage();
}

export async function createGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByRole("button", { name: "Yeni grup", exact: true }).click();
  await page.getByLabel("Grup adı").fill(name);
  await page.getByRole("button", { name: "Oluştur", exact: true }).click();

  await expect(page.getByText(name)).toBeVisible();
}

export async function openGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.locator(`a:has-text("${name}")`).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

export async function createGroupAndOpen(page: Page, name: string) {
  await createGroup(page, name);
  await openGroup(page, name);
}

type EqualExpenseInput = {
  description: string;
  amount: string;
  /** Secilmeyecek katilimcilarin gorunen adlari (varsayilan: herkes secili) */
  unselect?: string[];
};

export async function addEqualExpense(page: Page, input: EqualExpenseInput) {
  await page.getByRole("link", { name: "Harcama ekle" }).click();

  await page.getByLabel("Açıklama").fill(input.description);
  await page.getByLabel("Tutar").fill(input.amount);

  for (const name of input.unselect ?? []) {
    await page.getByRole("checkbox", { name }).uncheck();
  }

  await page.getByRole("button", { name: "Harcamayı kaydet" }).click();

  // Kaydetme bitince form bizi grup sayfasina geri gonderiyor. Bunu beklemek
  // sart: beklemeden devam edersek sonraki sayfa istegi, hala ucusta olan
  // POST'u iptal eder ve harcama yokmus gibi gorunur.
  await page.waitForURL(GROUP_PAGE_URL);
  await expect(page.getByText(input.description)).toBeVisible();
}

/**
 * Grubun davet linkini uretir ve dondurur. Ham token yalnizca olusturma
 * aninda gosterildigi icin dogrudan formdan okunuyor.
 */
export async function createInviteLink(page: Page, groupName: string): Promise<string> {
  await openGroup(page, groupName);
  await page.getByRole("link", { name: "Üyeleri yönet" }).click();
  await page.getByRole("button", { name: "Davet linki oluştur" }).click();

  const linkInput = page.locator("input[readonly]");
  await expect(linkInput).toBeVisible();

  const link = await linkInput.inputValue();
  expect(link).toContain("/join/");
  return link;
}

/**
 * Davet linkiyle gruba katilir.
 *
 * groupName parametresi zorunlu: eskiden "[e2e] ile baslayan bir baslik gorunur
 * mu" diye bakiyorduk, ama davet sayfasinin KENDISI de grup adini baslik olarak
 * gosteriyor. Yani katilma tamamlanmadan da bu kontrol geciyordu; test bir
 * sonraki sayfaya gecince POST /api/v1/invites/accept iptal oluyordu.
 */
export async function joinViaInvite(page: Page, inviteLink: string, groupName: string) {
  await page.goto(inviteLink);
  await page.getByRole("button", { name: "Gruba katıl" }).click();

  // Katilma basariliysa uygulama bizi grup sayfasina yonlendirir.
  await page.waitForURL(GROUP_PAGE_URL);
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
}
