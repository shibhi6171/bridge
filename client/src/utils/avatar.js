// Shared across Sidebar, ChatRoom, and MessageList so the same name/room
// always maps to the same gradient — that consistency is what makes it easy
// to tell people apart in a room at a glance.
export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
  "linear-gradient(135deg, #4f5bd5, #962fbf, #d62976, #fa7e1e)",
  "linear-gradient(135deg, #00c6ff, #0072ff)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #30cfd0, #330867)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #f6d365, #fda085)",
  "linear-gradient(135deg, #84fab0, #8fd3f4)",
];

export function gradientFor(name) {
  let hash = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// A readable solid color per name, for author labels next to/above bubbles
// where a gradient would be harder to read as text.
export const NAME_COLORS = [
  "#E1306C", "#5851DB", "#0095F6", "#00A85A",
  "#F77737", "#833AB4", "#C13584", "#1877F2",
  "#FA7E1E", "#38A169",
];

export function colorFor(name) {
  let hash = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}
