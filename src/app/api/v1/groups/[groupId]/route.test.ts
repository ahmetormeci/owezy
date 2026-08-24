import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

// Route'un kendi sorumlulugunu (auth kontrolu, cevap sekli, hata esleme) izole
// test ediyoruz. getGroupForUser'in ic mantigi src/lib/groups.test.ts'te.
const { mockGetOrCreateCurrentUser, mockGetGroupForUser, mockUpdateGroup } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockGetGroupForUser: vi.fn(),
  mockUpdateGroup: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

// updateGroup kullanilmiyor ama sahte modulde BULUNMAK zorunda: route dosyasi
// onu da import ediyor ve eksik birakilirsa import asamasinda patlar.
vi.mock("@/lib/groups", () => ({
  getGroupForUser: mockGetGroupForUser,
  updateGroup: mockUpdateGroup,
}));

const { GET } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const group = {
  id: GROUP_ID,
  name: "Ev",
  description: null,
  currency: "TRY",
  role: "MEMBER",
};

function callRoute() {
  const request = new NextRequest("http://localhost/api/v1/groups/x");
  return GET(request, { params: Promise.resolve({ groupId: GROUP_ID }) });
}

describe("GET /api/v1/groups/[groupId]", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockGetGroupForUser.mockReset();
  });

  it("giris yapilmamissa 401 doner ve getGroupForUser hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockGetGroupForUser).not.toHaveBeenCalled();
  });

  it("gecerli istekte getGroupForUser dogru argumanlarla cagrilir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupForUser.mockResolvedValue(group);

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, group });
    expect(mockGetGroupForUser).toHaveBeenCalledWith(USER_ID, GROUP_ID);
  });

  it("uye olmayan icin 403 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupForUser.mockRejectedValue(new ForbiddenError("group.not_member"));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe("group.not_member");
  });

  it("grup yoksa 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupForUser.mockRejectedValue(new NotFoundError("group.not_found"));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.code).toBe("group.not_found");
  });
});
