import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockupDefinition,
  mapArtworkPoint,
  mapArtworkPoints,
  isPointInsideMockupMask,
} from '../dist/esm/index.js';

const create = (overrides = {}) =>
  createMockupDefinition({
    id: 'shirt-front',
    width: 200,
    height: 160,
    placement: [
      { x: 20, y: 20 },
      { x: 180, y: 30 },
      { x: 160, y: 140 },
      { x: 40, y: 130 },
    ],
    mask: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 160 },
      { x: 0, y: 160 },
    ],
    ...overrides,
  });

test('solves a perspective transform that maps all four unit-square corners to declared corners', () => {
  const mockup = create();
  const mapped = mapArtworkPoints(mockup, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  mapped.forEach((point, index) => {
    assert.ok(Math.abs(point.x - mockup.placement[index].x) < 1e-8);
    assert.ok(Math.abs(point.y - mockup.placement[index].y) < 1e-8);
  });
});

test('maps interior points and supports affine parallelograms without a renderer', () => {
  const mockup = create({
    placement: [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 60 },
      { x: 10, y: 60 },
    ],
  });
  assert.deepEqual(mapArtworkPoint(mockup, { x: 0.5, y: 0.5 }), { x: 60, y: 35 });
});

test('checks mask inclusion including boundaries and defaults to unmasked when omitted', () => {
  const mockup = create();
  assert.equal(isPointInsideMockupMask(mockup, { x: 0, y: 80 }), true);
  assert.equal(isPointInsideMockupMask(mockup, { x: 201, y: 80 }), false);
  const unmasked = create({ mask: undefined });
  assert.equal(isPointInsideMockupMask(unmasked, { x: 1_000_000, y: 1_000_000 }), true);
  assert.throws(() => isPointInsideMockupMask(unmasked, { x: Infinity, y: 0 }), TypeError);
});

test('rejects degenerate, concave, self-intersecting, and out-of-canvas placements', () => {
  for (const placement of [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ],
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 100 },
    ],
    [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ],
    [
      { x: -1, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  ]) {
    assert.throws(() => create({ placement }), RangeError);
  }
});

test('rejects invalid point domains, excessive point batches, and self-crossing masks', () => {
  const mockup = create();
  assert.throws(() => mapArtworkPoint(mockup, { x: -0.01, y: 0.5 }), RangeError);
  assert.throws(
    () =>
      mapArtworkPoints(
        mockup,
        Array.from({ length: 10_001 }, () => ({ x: 0.5, y: 0.5 })),
      ),
    RangeError,
  );
  assert.throws(() => mapArtworkPoints(mockup, new Array(1)), TypeError);
  assert.throws(
    () =>
      create({
        mask: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 100, y: 0 },
        ],
      }),
    RangeError,
  );
});

test('validates bounded canvas dimensions and mask coordinates', () => {
  assert.throws(() => create({ width: 0 }), RangeError);
  assert.throws(
    () =>
      create({
        mask: [
          { x: -1, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
      }),
    RangeError,
  );
});
