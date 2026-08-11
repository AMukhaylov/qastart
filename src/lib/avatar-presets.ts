export type AvatarPreset = {
  id: string;
  label: string;
  dataUrl: string;
};

type AvatarSeed = {
  id: string;
  bg: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: "short" | "bob" | "curly" | "wave";
  mouth: "smile" | "soft" | "happy";
  glasses?: boolean;
};

const AVATAR_SEEDS: AvatarSeed[] = [
  {
    id: "indigo-smile",
    bg: "#E9EEFF",
    skin: "#F5C7A9",
    hair: "#2A1B18",
    shirt: "#4338CA",
    hairStyle: "short",
    mouth: "smile",
  },
  {
    id: "mint-bob",
    bg: "#E6FAF2",
    skin: "#E8B98F",
    hair: "#3A2419",
    shirt: "#059669",
    hairStyle: "bob",
    mouth: "soft",
  },
  {
    id: "sky-wave",
    bg: "#E7F3FF",
    skin: "#FFD4B8",
    hair: "#6D3B1F",
    shirt: "#0284C7",
    hairStyle: "wave",
    mouth: "happy",
  },
  {
    id: "rose-curly",
    bg: "#FFF0F5",
    skin: "#9B684B",
    hair: "#1E1B18",
    shirt: "#DB2777",
    hairStyle: "curly",
    mouth: "smile",
  },
  {
    id: "amber-short",
    bg: "#FFF7DE",
    skin: "#D79A72",
    hair: "#463020",
    shirt: "#D97706",
    hairStyle: "short",
    mouth: "soft",
  },
  {
    id: "violet-bob",
    bg: "#F2EFFF",
    skin: "#F0BFA1",
    hair: "#151827",
    shirt: "#7C3AED",
    hairStyle: "bob",
    mouth: "happy",
  },
  {
    id: "teal-wave",
    bg: "#DDF7F7",
    skin: "#C7835D",
    hair: "#26201C",
    shirt: "#0D9488",
    hairStyle: "wave",
    mouth: "smile",
    glasses: true,
  },
  {
    id: "lime-curly",
    bg: "#F0F9DF",
    skin: "#8D5A42",
    hair: "#211713",
    shirt: "#65A30D",
    hairStyle: "curly",
    mouth: "happy",
  },
  {
    id: "blue-short",
    bg: "#EAF2FF",
    skin: "#F7C9A6",
    hair: "#8B4E2B",
    shirt: "#2563EB",
    hairStyle: "short",
    mouth: "soft",
    glasses: true,
  },
  {
    id: "peach-wave",
    bg: "#FFF1E8",
    skin: "#E7A77D",
    hair: "#52321F",
    shirt: "#EA580C",
    hairStyle: "wave",
    mouth: "smile",
  },
  {
    id: "cyan-bob",
    bg: "#E0FAFF",
    skin: "#C98B62",
    hair: "#221A16",
    shirt: "#0891B2",
    hairStyle: "bob",
    mouth: "happy",
  },
  {
    id: "purple-curly",
    bg: "#F5E8FF",
    skin: "#F1C5A8",
    hair: "#372233",
    shirt: "#9333EA",
    hairStyle: "curly",
    mouth: "soft",
  },
  {
    id: "green-short",
    bg: "#E9FBEF",
    skin: "#A86D50",
    hair: "#171717",
    shirt: "#16A34A",
    hairStyle: "short",
    mouth: "smile",
  },
  {
    id: "red-wave",
    bg: "#FFECEC",
    skin: "#FFD0B0",
    hair: "#7F1D1D",
    shirt: "#DC2626",
    hairStyle: "wave",
    mouth: "happy",
  },
  {
    id: "slate-bob",
    bg: "#EEF2F7",
    skin: "#B97B5B",
    hair: "#111827",
    shirt: "#475569",
    hairStyle: "bob",
    mouth: "soft",
    glasses: true,
  },
  {
    id: "yellow-curly",
    bg: "#FEF8C8",
    skin: "#734D3C",
    hair: "#120D0B",
    shirt: "#CA8A04",
    hairStyle: "curly",
    mouth: "smile",
  },
  {
    id: "pink-short",
    bg: "#FFEAF4",
    skin: "#F2B892",
    hair: "#5A2C1E",
    shirt: "#E11D48",
    hairStyle: "short",
    mouth: "happy",
  },
  {
    id: "aqua-wave",
    bg: "#E5FBF8",
    skin: "#D29168",
    hair: "#2B201B",
    shirt: "#14B8A6",
    hairStyle: "wave",
    mouth: "soft",
  },
  {
    id: "lavender-bob",
    bg: "#EFEAFF",
    skin: "#F7C9B0",
    hair: "#2E1F5E",
    shirt: "#4F46E5",
    hairStyle: "bob",
    mouth: "smile",
  },
  {
    id: "orange-curly",
    bg: "#FFF3E0",
    skin: "#A66A4A",
    hair: "#201714",
    shirt: "#F97316",
    hairStyle: "curly",
    mouth: "happy",
    glasses: true,
  },
];

export const AVATAR_PRESETS: AvatarPreset[] = AVATAR_SEEDS.map((seed, index) => ({
  id: seed.id,
  label: `Аватар ${index + 1}`,
  dataUrl: svgToDataUrl(createAvatarSvg(seed)),
}));

export function getAvatarPresetById(id: string) {
  return AVATAR_PRESETS.find((preset) => preset.id === id) ?? null;
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createAvatarSvg(seed: AvatarSeed) {
  const hair = getHair(seed);
  const mouth =
    seed.mouth === "happy"
      ? '<path d="M69 93c7 8 18 8 25 0" fill="none" stroke="#172033" stroke-width="4" stroke-linecap="round"/>'
      : seed.mouth === "soft"
        ? '<path d="M72 94c6 4 14 4 20 0" fill="none" stroke="#172033" stroke-width="4" stroke-linecap="round"/>'
        : '<path d="M70 92c7 6 17 6 24 0" fill="none" stroke="#172033" stroke-width="4" stroke-linecap="round"/>';
  const glasses = seed.glasses
    ? '<g fill="none" stroke="#172033" stroke-width="3"><circle cx="65" cy="75" r="10"/><circle cx="95" cy="75" r="10"/><path d="M75 75h10"/></g>'
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
<rect width="160" height="160" rx="48" fill="${seed.bg}"/>
<circle cx="80" cy="80" r="58" fill="#ffffff" opacity=".42"/>
<path d="M41 137c7-24 25-36 39-36s32 12 39 36" fill="${seed.shirt}"/>
<path d="M68 101h24v22c0 8-24 8-24 0z" fill="${seed.skin}"/>
<circle cx="52" cy="76" r="9" fill="${seed.skin}"/>
<circle cx="108" cy="76" r="9" fill="${seed.skin}"/>
${hair.back}
<ellipse cx="80" cy="75" rx="31" ry="37" fill="${seed.skin}"/>
${hair.front}
<circle cx="68" cy="77" r="3.7" fill="#172033"/>
<circle cx="92" cy="77" r="3.7" fill="#172033"/>
<path d="M79 80l-4 10h8" fill="none" stroke="#C07F5A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
${mouth}
${glasses}
<path d="M58 66c5-4 11-4 16-1M87 65c5-3 11-3 16 1" fill="none" stroke="#172033" stroke-width="3" stroke-linecap="round" opacity=".55"/>
</svg>`;
}

function getHair(seed: AvatarSeed) {
  if (seed.hairStyle === "bob") {
    return {
      back: `<path d="M49 77c0-30 14-48 32-48s31 18 31 48c0 14-5 30-14 39-4-7-11-10-18-10s-14 3-18 10c-8-9-13-25-13-39z" fill="${seed.hair}"/>`,
      front: `<path d="M50 70c8-29 25-37 52-27 8 10 11 18 10 31-12-4-25-15-31-27-6 13-17 22-31 23z" fill="${seed.hair}"/>`,
    };
  }

  if (seed.hairStyle === "curly") {
    return {
      back: "",
      front: `<g fill="${seed.hair}"><circle cx="54" cy="58" r="13"/><circle cx="66" cy="47" r="15"/><circle cx="82" cy="44" r="16"/><circle cx="98" cy="51" r="14"/><circle cx="108" cy="64" r="12"/><path d="M52 70c12-8 19-17 22-28 7 16 19 24 39 27-1-25-13-42-33-42S48 45 52 70z"/></g>`,
    };
  }

  if (seed.hairStyle === "wave") {
    return {
      back: "",
      front: `<path d="M49 69c5-27 20-40 43-36 17 3 27 15 29 35-16 0-32-10-40-23-7 16-17 23-32 24z" fill="${seed.hair}"/>`,
    };
  }

  return {
    back: "",
    front: `<path d="M50 69c3-24 15-38 35-38 18 0 31 14 34 38-17-2-32-9-42-24-5 12-15 20-27 24z" fill="${seed.hair}"/>`,
  };
}
