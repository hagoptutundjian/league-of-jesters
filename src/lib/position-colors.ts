// Position color scheme used throughout the app
export const positionColors: Record<string, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  badgeBg: string;
}> = {
  QB: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-l-4 border-l-red-500",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    badgeBg: "bg-red-500",
  },
  WR: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-l-4 border-l-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    badgeBg: "bg-blue-500",
  },
  RB: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-l-4 border-l-green-500",
    text: "text-green-700 dark:text-green-400",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    badgeBg: "bg-green-500",
  },
  TE: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-l-4 border-l-purple-500",
    text: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    badgeBg: "bg-purple-500",
  },
};

export function getPositionColor(position: string) {
  return positionColors[position] || positionColors.QB;
}

export function getPositionName(pos: string) {
  switch (pos) {
    case "QB": return "Quarterbacks";
    case "WR": return "Wide Receivers";
    case "RB": return "Running Backs";
    case "TE": return "Tight Ends";
    default: return pos;
  }
}
