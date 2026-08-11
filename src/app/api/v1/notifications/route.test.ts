import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetOrCreateCurrentUser, mockListNotifications, mockCountUnread } = vi.hoisted(
  () => ({
    mockGetOrCreateCurrentUser: vi.fn(),
    mockListNotifications: vi.fn(),
    mockCountUnread: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/notifications", () => ({
  listNotifications: mockListNotifications,
  countUnreadNotifications: mockCountUnread,
}));

const { GET } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";
const CURSOR = "33333333-3333-4333-8333-333333333333";

function callRoute(query = "") {
  return GET(new NextRequest(`http://localhost/api/v1/notifications${query}`));
}

beforeEach(() => {
  mockGetOrCreateCurrentUser.mockReset();
  mockListNotifications.mockReset();
  mockCountUnread.mockReset();

  mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
  mockListNotifications.mockResolvedValue({ notifications: [], nextCursor: null });
  mockCountUnread.mockResolvedValue(0);
});

describe("GET /api/v1/notifications", () => {
  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockListNotifications).not.toHaveBeenCalled();
  });

  // Adreste kullanici kimligi YOK: liste her zaman oturumdaki kisiye ait.
  // Baskasinin bildirimlerini istemenin bir yolu bulunmamali.
  it("listeyi her zaman oturumdaki kullanici icin ister", async () => {
    await callRoute("?limit=10");

    expect(mockListNotifications).toHaveBeenCalledWith(USER_ID, { limit: 10 });
  });

  it("okunmamis sayisini ayni cevapta doner", async () => {
    mockCountUnread.mockResolvedValue(4);
    mockListNotifications.mockResolvedValue({
      notifications: [{ id: "n1" }],
      nextCursor: "n1",
    });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      notifications: [{ id: "n1" }],
      nextCursor: "n1",
      unreadCount: 4,
    });
  });

  it("unreadOnly=true filtreyi acar", async () => {
    await callRoute("?unreadOnly=true");

    expect(mockListNotifications).toHaveBeenCalledWith(USER_ID, { unreadOnly: true });
  });

  // Klasik tuzak: z.coerce.boolean() kullansaydik bos olmayan her string
  // true olurdu ve "false" da filtreyi acardi.
  it("unreadOnly=false filtreyi ACMAZ", async () => {
    await callRoute("?unreadOnly=false");

    expect(mockListNotifications).toHaveBeenCalledWith(USER_ID, { unreadOnly: false });
  });

  it("cursor'u servise gecirir", async () => {
    await callRoute(`?cursor=${CURSOR}`);

    expect(mockListNotifications).toHaveBeenCalledWith(USER_ID, { cursor: CURSOR });
  });

  it("gecersiz limit icin 400 doner", async () => {
    const response = await callRoute("?limit=999");

    expect(response.status).toBe(400);
    expect(mockListNotifications).not.toHaveBeenCalled();
  });

  it("cursor uuid degilse 400 doner", async () => {
    const response = await callRoute("?cursor=abc");

    expect(response.status).toBe(400);
    expect(mockListNotifications).not.toHaveBeenCalled();
  });
});
