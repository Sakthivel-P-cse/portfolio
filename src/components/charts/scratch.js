const EVENT_COLORS = {
  PROFIT: "#22C55E", // bright green
  LOSS: "#EF4444", // bright red
};

const raw = [
  { time: 1, netPnl: 0, pnlDelta: 0, kind: "PROFIT" }, // July
  { time: 2, netPnl: 100, pnlDelta: 100, kind: "PROFIT" }, // Aug
  { time: 3, netPnl: -50, pnlDelta: -150, kind: "LOSS" }, // Sep
];

const classified = raw.map(r => ({ ...r, color: EVENT_COLORS[r.kind] }));

const points = raw.map((p, i) => {
  const { color } = classified[i];
  const segmentColor = i < raw.length - 1 ? classified[i + 1].color : color;
  return { time: p.time, color, segmentColor };
});

console.log("Aug:", points[1]);
console.log("Sep:", points[2]);
