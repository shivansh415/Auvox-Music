/**
 * Client preview build. With NEXT_PUBLIC_SHOWCASE=1 (set on the Vercel project) the site shows only the
 * finished parts — preloader, splash, hero, Verse Universe and Journey — and the pages still being built
 * point to /coming-soon. Locally the flag is off and everything is visible.
 */
export const SHOWCASE = process.env.NEXT_PUBLIC_SHOWCASE === "1";

/** routes that aren't ready for the client yet */
export const UNFINISHED_ROUTES = ["/guitar-verse", "/piano-verse", "/support", "/reserve", "/packages", "/enroll", "/payment", "/dashboard"];
