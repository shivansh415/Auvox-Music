// Packages, add-ons and the comparison table — from the client's "Website Notes & Body" (verbatim).

export type Verse = "guitar" | "piano";
export type Tier = "core" | "complete";

export type Package = {
  id: `${Verse}-${Tier}`;
  verse: Verse;
  tier: Tier;
  name: string;
  price: number;
  currency: "CAD";
  bestValue?: boolean;
  includes: string[];
  addOns: { name: string; price: number }[];
};

export const ADD_ON_WHATSAPP = { name: "WhatsApp support", price: 24.99 };
export const ADD_ON_CLASSES = { name: "2 additional live classes", price: 59.99 };

export const PACKAGES: Package[] = [
  {
    id: "guitar-core",
    verse: "guitar",
    tier: "core",
    name: "Guitar Core",
    price: 349,
    currency: "CAD",
    includes: ["6 live classes + 1 bonus class", "1 personal doubt-solving session", "Digital music sheets", "The Frequency Box", "Exclusive surprise gift", "Official AUVOX T-shirt"],
    addOns: [ADD_ON_WHATSAPP, ADD_ON_CLASSES],
  },
  {
    id: "guitar-complete",
    verse: "guitar",
    tier: "complete",
    name: "Guitar Complete",
    price: 429,
    currency: "CAD",
    bestValue: true,
    includes: ["Guitar included", "8 live classes + 1 bonus class", "2 personal doubt-solving sessions", "Digital music sheets", "The Frequency Box", "Exclusive surprise gift", "Official AUVOX T-shirt", "WhatsApp support"],
    addOns: [ADD_ON_CLASSES],
  },
  {
    id: "piano-core",
    verse: "piano",
    tier: "core",
    name: "Piano Core",
    price: 379,
    currency: "CAD",
    includes: ["6 live classes + 1 bonus class", "1 personal doubt-solving session", "Digital music sheets", "The Frequency Box", "Exclusive surprise gift", "Official AUVOX T-shirt"],
    addOns: [ADD_ON_WHATSAPP, ADD_ON_CLASSES],
  },
  {
    id: "piano-complete",
    verse: "piano",
    tier: "complete",
    name: "Piano Complete",
    price: 449,
    currency: "CAD",
    bestValue: true,
    includes: ["Keyboard included", "8 live classes + 1 bonus class", "2 personal doubt-solving sessions", "Digital music sheets", "The Frequency Box", "Exclusive surprise gift", "Official AUVOX T-shirt", "WhatsApp support"],
    addOns: [ADD_ON_CLASSES],
  },
];

export const packagesFor = (verse: Verse) => PACKAGES.filter((p) => p.verse === verse);
export const packageById = (id: string) => PACKAGES.find((p) => p.id === id);

/** Comparison rows (client reference). Values: true/false or text. */
export const COMPARISON = (verse: Verse): { label: string; core: boolean | string; complete: boolean | string }[] => [
  { label: verse === "guitar" ? "Guitar" : "Keyboard", core: false, complete: true },
  { label: "The Frequency Box", core: true, complete: true },
  { label: "Exclusive Surprise Gift", core: true, complete: true },
  { label: "Premium AUVOX T-shirt", core: true, complete: true },
  { label: "Music Sheet (PDF)", core: true, complete: true },
  { label: "Priority WhatsApp Support", core: "Add-on", complete: true },
  { label: "Doubt Solving Session", core: "1", complete: "2" },
  { label: "Exclusive Bonus Session", core: true, complete: true },
];

export const VERSE_COPY = {
  guitar: {
    kicker: "Guitar Verse",
    title: "The magic of six strings begins here.",
    accent: "here.",
    body: "A guided path from your first chord to your first complete song.",
    points: ["Built for beginners.", "Guided by musicians.", "Shape your sound."],
  },
  piano: {
    kicker: "Piano Verse",
    title: "The magic of keys and melodies begins here.",
    accent: "here.",
    body: "Discover the piano as one complete instrument, capable of expressing every musical idea—from simple melodies to timeless compositions.",
    points: ["Guided learning stages.", "Connect with the keys.", "Build something timeless."],
  },
} as const;

export const ABOUT = {
  what: {
    kicker: "What is AUVOX",
    title: "More than lessons, a musical journey built around you.",
    accent: "you.",
    body: [
      "AUVOX MUSIC is not just a normal music academy but, it brings in live instruction, structured learning, premium physical materials, digital resources, and personal guidance into one connected experience.",
      "Every learner enters a focused musical world designed to help them begin with clarity and continue with confidence.",
    ],
  },
  why: {
    kicker: "Why choose AUVOX",
    title: "Designed around the complete learner not only the lesson.",
    accent: "lesson.",
    points: ["Live personal guidance", "Focused doubt solving sessions", "Support beyond the session", "A growing musical universe"],
  },
} as const;

export const JOURNEY = {
  kicker: "How AUVOX works",
  title: "Your AUVOX Journey",
  accent: "Journey",
  body: "A step-by-step guide to beginning your musical journey with us.",
  steps: [
    { title: "Choose Your Instrument", body: "Choose Guitar Verse or Piano Verse. Every musical journey begins with the instrument that speaks to you." },
    { title: "Book a Free Demo", body: "Meet an AUVOX instructor, experience a live class, and ask any questions you may have." },
    { title: "Select Your Package", body: "Choose between two packages: Core for the essentials or Complete for the full AUVOX experience." },
    { title: "Receive Your AUVOX Kit", body: "Your Frequency Box and included learning materials will be delivered to your doorstep. Students enrolled in a Complete package will also receive their selected musical instrument." },
    { title: "Begin Your Live Classes", body: "Attend structured live sessions, receive real feedback, and learn songs you genuinely love." },
  ],
} as const;

export const FREQUENCY_BOX = {
  kicker: "The AUVOX Frequency Box",
  title: "More than a package. The beginning of your musical journey.",
  accent: "journey.",
  body: [
    "The Frequency Box is a premium and minimal welcome experience created to celebrate the beginning of your journey with AUVOX.",
    "It includes thoughtfully selected essentials, learning materials, and exclusive AUVOX surprises designed to help you begin with confidence.",
  ],
  cta: "Join AUVOX Today",
} as const;

export const BEGIN = {
  kicker: "Begin",
  title: "Your Verse. Begins Here.",
  accent: "Here.",
  body: "Choose your instrument, meet your instructor and begin YOUR AUVOX JOURNEY now.",
  primary: "Reserve your Free Demo",
  secondary: "Explore Packages",
} as const;

export const SUPPORT_FAQ = [
  { q: "What is included in the Core package?", a: "6 live classes plus 1 bonus class, 1 personal doubt-solving session, digital music sheets, The Frequency Box, an exclusive surprise gift and the official AUVOX T-shirt.", tags: ["packages"] },
  { q: "What is the difference between Core and Complete?", a: "Complete adds the instrument (guitar or keyboard), 8 live classes + 1 bonus instead of 6 + 1, a second doubt-solving session and WhatsApp support.", tags: ["packages"] },
  { q: "Do I need my own instrument?", a: "Not with a Complete package — your guitar or keyboard ships with your AUVOX Kit. With Core you use your own instrument.", tags: ["packages", "guitar", "piano"] },
  { q: "What is The Frequency Box?", a: "A premium, minimal welcome box with thoughtfully selected essentials, learning materials and exclusive AUVOX surprises. It stays a surprise until it reaches you.", tags: ["frequency-box"] },
  { q: "How do live classes work?", a: "Classes are live, structured sessions with an AUVOX instructor. You get real feedback and learn songs you genuinely love.", tags: ["classes"] },
  { q: "Can I book a free demo first?", a: "Yes. Reserve a free demo, meet an instructor, experience a live class and ask anything before you choose a package.", tags: ["demo"] },
  { q: "Can I add extra classes later?", a: "Yes — 2 additional live classes are available as an add-on for $59.99 CAD.", tags: ["packages", "add-ons"] },
  { q: "Is WhatsApp support included?", a: "It is included with Complete packages and available as a $24.99 CAD add-on with Core.", tags: ["add-ons", "support"] },
  { q: "Which T-shirt sizes are available?", a: "XS, S, M, L and XL — you pick your size on the enrollment form.", tags: ["kit"] },
  { q: "How do I renew my package?", a: "When you have 3–4 session credits left, renewal options appear in your dashboard and you can renew from there.", tags: ["dashboard"] },
  { q: "I'm a complete beginner. Is AUVOX for me?", a: "Yes. Both verses are built for beginners and guided by musicians, from your first chord or key to your first complete song.", tags: ["classes", "guitar", "piano"] },
  { q: "How much do the packages cost?", a: "Guitar Core is $349, Guitar Complete $429, Piano Core $379 and Piano Complete $449, all in CAD.", tags: ["packages", "guitar", "piano"] },
  { q: "How do I choose between Guitar Verse and Piano Verse?", a: "Start with the instrument that speaks to you. Not sure yet? Book a free demo and an AUVOX instructor will help you decide.", tags: ["demo", "guitar", "piano"] },
  { q: "Are the classes live or recorded?", a: "Live. Every class is a real session with an AUVOX instructor, not a recording, so you get feedback as you play.", tags: ["classes"] },
  { q: "What's in my AUVOX Kit?", a: "Your Frequency Box and the learning materials for your package. Complete packages also include your instrument: a guitar or a keyboard.", tags: ["kit", "frequency-box"] },
  { q: "What happens after I enroll?", a: "Fill in the enrollment form, complete the payment and you land in your student dashboard. Your AUVOX Kit is delivered to your door and your live classes begin.", tags: ["packages", "dashboard"] },
  { q: "Can I change my class time?", a: "Yes. From your dashboard, send the ready-drafted email with the time slot you'd like and we'll reply with what's open.", tags: ["dashboard", "classes"] },
  { q: "Where can I see how many sessions I have left?", a: "Your dashboard shows your package status, the days left and the session credits you've used and have left.", tags: ["dashboard"] },
  { q: "How do I reach a real person?", a: "Email us at hello@auvoxmusic.com. Use the Email us button on this page and your question is already in the draft.", tags: ["support"] },
];

export const CONTACT_EMAIL = "hello@auvoxmusic.com";
