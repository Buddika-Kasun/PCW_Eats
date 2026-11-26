import crypto from "crypto";

export interface LocalUser {
  id: number | string;
  username: string;
  displayname: string;
  email: string;
  role: string;
  profilePicture: string | null;
  isLocal: true;
}

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-insecure-secret";

// ---------------------------------------------------------------------------
// Hardcoded local accounts
// ---------------------------------------------------------------------------
const LOCAL_ACCOUNTS: Array<{
  username: string;
  password: string;
  user: LocalUser;
}> = [
  {
    username: process.env.LOCAL_CANTEEN_USER || "mycanteen",
    password: process.env.LOCAL_CANTEEN_PASS || "mycanteen",
    user: {
      id: "2000",
      username: process.env.LOCAL_CANTEEN_USER || "mycanteen",
      displayname: "Canteen Operator",
      email: "canteen@local",
      role: "canteen",
      profilePicture: null,
      isLocal: true,
    },
  },
  {
    username: process.env.LOCAL_DEV_USER || "dev",
    password: process.env.LOCAL_DEV_PASS || "dev",
    user: {
      id: "1000",
      username: process.env.LOCAL_DEV_USER || "dev",
      displayname: "Developer",
      email: "dev@local",
      role: "sysadmin",
      profilePicture: null,
      isLocal: true,
    },
  },
];

export function findLocalAccount(
  username: string,
  password: string,
): LocalUser | null {
  const acct = LOCAL_ACCOUNTS.find(
    (a) => a.username === username && a.password === password,
  );
  return acct ? acct.user : null;
}

// ---------------------------------------------------------------------------
// Signed session token: base64url(payload).base64url(hmac)
// ---------------------------------------------------------------------------
export function signLocalToken(user: LocalUser): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.username, role: user.role, iat: Date.now() }),
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  return `local.${payload}.${sig}`;
}

export function verifyLocalToken(token: string): LocalUser | null {
  if (!token.startsWith("local.")) return null;

  const [, payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  // Constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const acct = LOCAL_ACCOUNTS.find((x) => x.user.username === data.sub);
    return acct ? acct.user : null;
  } catch {
    return null;
  }
}
