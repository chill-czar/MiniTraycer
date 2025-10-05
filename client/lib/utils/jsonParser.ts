// lib/utils/jsonParser.ts
export const parseJSON = <T>(text: string, fallback: T): T => {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
};
