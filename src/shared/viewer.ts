/** Who is looking at the app, as far as the UI needs to know (computed on the server). */
export interface Viewer {
  signedIn: boolean;
  /** Which account system is active: Clerk, the e2e test session, or none (guest-only app). */
  accounts: "clerk" | "test" | "none";
}

export const GUEST_VIEWER: Viewer = { signedIn: false, accounts: "none" };
