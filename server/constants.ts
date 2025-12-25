// Header that can be used in development to set a distinct user id
export const DEV_USER_HEADER = "x-dev-user-id";

// Session secret used only when Clerk is not configured (development only)
export const DEV_SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";
