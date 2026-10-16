import { describe, expect, it } from "vitest";
import { seatPositions } from "../../src/ui/seatLayout.ts";

const shape = { width: 100, height: 140, cornerRadius: 28 };

describe("seatPositions", () => {
  it("returns one position per seat", () => {
    expect(seatPositions(8, shape)).toHaveLength(8);
  });

  it("puts two seats face to face on the long sides", () => {
    const [first, second] = seatPositions(2, shape);
    expect(first?.x).toBeCloseTo(100);
    expect(first?.y).toBeCloseTo(50);
    expect(second?.x).toBeCloseTo(0);
    expect(second?.y).toBeCloseTo(50);
  });

  it("goes clockwise from the top", () => {
    const [first, second, third] = seatPositions(4, shape);
    expect(first!.x).toBeGreaterThan(50);
    expect(first!.y).toBeLessThan(50);
    expect(second!.y).toBeGreaterThan(50);
    expect(second!.x).toBeGreaterThan(50);
    expect(third!.x).toBeLessThan(50);
  });

  it("places a table of 10 symmetrically about the vertical centre line", () => {
    const positions = seatPositions(10, shape);
    for (let seat = 0; seat < 5; seat += 1) {
      const mirror = positions[9 - seat]!;
      expect(positions[seat]!.x).toBeCloseTo(100 - mirror.x);
      expect(positions[seat]!.y).toBeCloseTo(mirror.y);
    }
  });

  it("moves seats outside the edge by the outset", () => {
    const outset = 5;
    const [first, second] = seatPositions(2, shape, outset);
    // Two seats sit in the middle of the long sides, so the outset shows directly in x.
    expect(first?.x).toBeCloseTo(105);
    expect(second?.x).toBeCloseTo(-5);
    expect(first?.y).toBeCloseTo(50);
  });

  it("gives the same positions with no outset as before", () => {
    expect(seatPositions(8, shape, 0)).toEqual(seatPositions(8, shape));
  });

  it("keeps every seat on the edge of the table", () => {
    for (const { x, y } of seatPositions(9, shape)) {
      const px = (x / 100) * shape.width;
      const py = (y / 100) * shape.height;
      const r = shape.cornerRadius;
      const nearestX = Math.min(Math.max(px, r), shape.width - r);
      const nearestY = Math.min(Math.max(py, r), shape.height - r);
      const inCorner = nearestX !== px && nearestY !== py;
      const onEdge = inCorner
        ? Math.abs(Math.hypot(px - nearestX, py - nearestY) - r) < 1e-9
        : px === 0 || px === shape.width || py === 0 || py === shape.height;
      expect(onEdge).toBe(true);
    }
  });
});
