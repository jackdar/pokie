export type TableShape = {
  width: number;
  height: number;
  cornerRadius: number;
};

export type SeatPosition = {
  /** Percent of the table width, from the left edge. */
  x: number;
  /** Percent of the table height, from the top edge. */
  y: number;
};

type Segment =
  | { kind: "line"; length: number; from: [number, number]; to: [number, number] }
  | { kind: "arc"; length: number; centre: [number, number]; startAngle: number };

function line(from: [number, number], to: [number, number]): Segment {
  return { kind: "line", length: Math.hypot(to[0] - from[0], to[1] - from[1]), from, to };
}

function perimeterSegments({ width: w, height: h, cornerRadius: r }: TableShape): Segment[] {
  const quarterArc = (Math.PI * r) / 2;
  const arc = (centre: [number, number], startAngle: number): Segment => ({
    kind: "arc",
    length: quarterArc,
    centre,
    startAngle,
  });

  // Clockwise from the middle of the top edge. Angles use screen coordinates, so y grows downward.
  return [
    line([w / 2, 0], [w - r, 0]),
    arc([w - r, r], -Math.PI / 2),
    line([w, r], [w, h - r]),
    arc([w - r, h - r], 0),
    line([w - r, h], [r, h]),
    arc([r, h - r], Math.PI / 2),
    line([0, h - r], [0, r]),
    arc([r, r], Math.PI),
    line([r, 0], [w / 2, 0]),
  ];
}

function pointOnSegment(segment: Segment, distance: number, r: number): [number, number] {
  if (segment.kind === "line") {
    const t = segment.length === 0 ? 0 : distance / segment.length;
    return [
      segment.from[0] + (segment.to[0] - segment.from[0]) * t,
      segment.from[1] + (segment.to[1] - segment.from[1]) * t,
    ];
  }
  const angle = segment.startAngle + distance / r;
  return [segment.centre[0] + r * Math.cos(angle), segment.centre[1] + r * Math.sin(angle)];
}

/**
 * Spaces the seats evenly along the edge of a rounded rectangle, clockwise.
 * Each seat sits half a gap from the top centre, so two seats face each other across the table.
 * An outset moves the seats that far outside the edge. This gives them a longer path and more room.
 */
export function seatPositions(seatCount: number, shape: TableShape, outset = 0): SeatPosition[] {
  const path: TableShape = {
    width: shape.width + 2 * outset,
    height: shape.height + 2 * outset,
    cornerRadius: shape.cornerRadius + outset,
  };
  const segments = perimeterSegments(path);
  const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);

  return Array.from({ length: seatCount }, (_, seat) => {
    let remaining = (perimeter * (seat + 0.5)) / seatCount;
    for (const segment of segments) {
      if (remaining <= segment.length) {
        const [px, py] = pointOnSegment(segment, remaining, path.cornerRadius);
        return {
          x: ((px - outset) / shape.width) * 100,
          y: ((py - outset) / shape.height) * 100,
        };
      }
      remaining -= segment.length;
    }
    return { x: 50, y: 0 };
  });
}
