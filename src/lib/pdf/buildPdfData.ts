export function buildPdfData({
  lang,
  drugName,
  numbers,
  result,
  schedule,
  instruction,
  prepTime,
}) {
  const TH = lang === "th";

  return {
    title: TH
      ? "สรุปการใช้ยาน้ำสำหรับเด็ก"
      : "Pediatric Liquid Medication Summary",

    drugName: drugName || "-",

    summary: {
      duration: result.totalDays,
      totalMl: result.totalMl,
      bottles: result.bottles,
      discarded: result.totalDiscarded,
    },

    instruction,

    schedule: schedule.map((s) => ({
      bottle: s.idx,
      start: s.startDate,
      end: s.endDate,
      used: s.used,
      discard: s.discarded,
      remaining: s.remainingInBottle,
    })),

    preparedAt: prepTime,
  };
}
