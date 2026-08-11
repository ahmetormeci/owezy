import path from "node:path";

// Uc test kullanicisi: yetki ve cok kisili bolusum senaryolari icin gerekli.
// Sifreler .env.local'den okunuyor, koda hicbir zaman yazilmiyor.
export type E2EUser = {
  key: "owner" | "member" | "outsider";
  email: string;
  password: string;
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
    email: requireEnv("E2E_CLERK_USER_1_EMAIL"),
    password: requireEnv("E2E_CLERK_USER_1_PASSWORD"),
    storageStatePath: path.join(authDir, "owner.json"),
  },
  {
    key: "member",
    email: requireEnv("E2E_CLERK_USER_2_EMAIL"),
    password: requireEnv("E2E_CLERK_USER_2_PASSWORD"),
    storageStatePath: path.join(authDir, "member.json"),
  },
  {
    key: "outsider",
    email: requireEnv("E2E_CLERK_USER_3_EMAIL"),
    password: requireEnv("E2E_CLERK_USER_3_PASSWORD"),
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
