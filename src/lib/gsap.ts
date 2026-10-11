"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin, MorphSVGPlugin, Flip);

export { gsap, ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin, MorphSVGPlugin, Flip, useGSAP };

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __gsap: unknown }).__gsap = { gsap, ScrollTrigger };
}
