export interface Point {
  x: number;
  y: number;
}

export interface MockupDefinition {
  id: string;
  width: number;
  height: number;
  placement: readonly [Point, Point, Point, Point];
  mask?: readonly Point[];
}

export interface ValidMockupDefinition {
  id: string;
  width: number;
  height: number;
  placement: readonly [Point, Point, Point, Point];
  mask?: readonly Point[];
  homography: readonly [number, number, number, number, number, number, number, number, number];
}

const EPSILON = 1e-10;
const MAX_DIMENSION = 1_000_000;
const MAX_POLYGON_POINTS = 64;

function assertDataFields(
  value: unknown,
  name: string,
  allowed: readonly string[],
  required: readonly string[],
): void {
  if (
    !value ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${name} must be a plain record.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      !allowed.includes(key) ||
      !descriptor?.enumerable ||
      !('value' in descriptor)
    ) {
      throw new TypeError(`${name} has an unsupported field or accessor.`);
    }
  }
  if (required.some((key) => !Object.hasOwn(value, key))) {
    throw new TypeError(`${name} is missing a required field.`);
  }
}

function point(value: unknown, name: string): Point {
  assertDataFields(value, name, ['x', 'y'], ['x', 'y']);
  const { x, y } = value as { x: unknown; y: unknown };
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y)
  ) {
    throw new TypeError(`${name} coordinates must be finite numbers.`);
  }
  return { x, y };
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.abs(cross(a, b, p)) <= EPSILON &&
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.y >= Math.min(a.y, b.y) - EPSILON &&
    p.y <= Math.max(a.y, b.y) + EPSILON
  );
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return (
    (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
      ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}

function validatePolygon(points: readonly Point[], name: string): void {
  if (points.length < 3 || points.length > MAX_POLYGON_POINTS) {
    throw new RangeError(`${name} must contain 3..${MAX_POLYGON_POINTS} points.`);
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= EPSILON) {
      throw new RangeError(`${name} cannot have duplicate adjacent points.`);
    }
    for (let j = i + 1; j < points.length; j++) {
      if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i) continue;
      if (segmentsIntersect(a, b, points[j]!, points[(j + 1) % points.length]!)) {
        throw new RangeError(`${name} must not self-intersect.`);
      }
    }
  }
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]!;
    return sum + p.x * next.y - next.x * p.y;
  }, 0);
  if (Math.abs(area) <= EPSILON) throw new RangeError(`${name} must enclose a nonzero area.`);
}

function solveHomography(
  corners: readonly Point[],
): [number, number, number, number, number, number, number, number, number] {
  const unit = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const matrix: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = unit[i]!;
    const target = corners[i]!;
    matrix.push([x, y, 1, 0, 0, 0, -target.x * x, -target.x * y, target.x]);
    matrix.push([0, 0, 0, x, y, 1, -target.y * x, -target.y * y, target.y]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(matrix[pivot]![column]!) < EPSILON) {
      throw new RangeError('Placement quadrilateral has a degenerate homography.');
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    const divisor = matrix[column]![column]!;
    for (let j = column; j < 9; j++) matrix[column]![j]! /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = matrix[row]![column]!;
      for (let j = column; j < 9; j++) matrix[row]![j]! -= factor * matrix[column]![j]!;
    }
  }
  return [
    matrix[0]![8]!,
    matrix[1]![8]!,
    matrix[2]![8]!,
    matrix[3]![8]!,
    matrix[4]![8]!,
    matrix[5]![8]!,
    matrix[6]![8]!,
    matrix[7]![8]!,
    1,
  ];
}

export function createMockupDefinition(definition: MockupDefinition): ValidMockupDefinition {
  assertDataFields(
    definition,
    'Mockup definition',
    ['id', 'width', 'height', 'placement', 'mask'],
    ['id', 'width', 'height', 'placement'],
  );
  if (typeof definition.id !== 'string' || !/^[A-Za-z][\w.-]{0,127}$/.test(definition.id)) {
    throw new TypeError('Mockup ID must be a safe identifier up to 128 characters.');
  }
  for (const [name, value] of [
    ['width', definition.width],
    ['height', definition.height],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0 || value > MAX_DIMENSION) {
      throw new RangeError(`${name} must be an integer from 1 to ${MAX_DIMENSION}.`);
    }
  }
  if (!Array.isArray(definition.placement) || definition.placement.length !== 4) {
    throw new RangeError(
      'Placement must contain four ordered corners: top-left, top-right, bottom-right, bottom-left.',
    );
  }
  const placement = definition.placement.map((corner, index) =>
    point(corner, `Placement corner ${index}`),
  ) as [Point, Point, Point, Point];
  for (const p of placement) {
    if (p.x < 0 || p.y < 0 || p.x > definition.width || p.y > definition.height) {
      throw new RangeError('Placement corners must lie within the mockup canvas.');
    }
  }
  validatePolygon(placement, 'Placement quadrilateral');
  const turns = placement.map((p, index) =>
    cross(p, placement[(index + 1) % 4]!, placement[(index + 2) % 4]!),
  );
  if (
    turns.some((turn) => Math.abs(turn) <= EPSILON) ||
    turns.some((turn) => Math.sign(turn) !== Math.sign(turns[0]!))
  ) {
    throw new RangeError(
      'Placement corners must form a strictly convex quadrilateral in perimeter order.',
    );
  }
  const mask = definition.mask?.map((item, index) => point(item, `Mask point ${index}`));
  if (mask !== undefined) {
    validatePolygon(mask, 'Mask polygon');
    for (const p of mask) {
      if (p.x < 0 || p.y < 0 || p.x > definition.width || p.y > definition.height) {
        throw new RangeError('Mask points must lie within the mockup canvas.');
      }
    }
  }
  const homography = solveHomography(placement);
  return {
    id: definition.id,
    width: definition.width,
    height: definition.height,
    placement,
    ...(mask === undefined ? {} : { mask }),
    homography,
  };
}

export function mapArtworkPoint(definition: ValidMockupDefinition, source: Point): Point {
  if (
    !definition ||
    !Array.isArray(definition.homography) ||
    definition.homography.length !== 9 ||
    definition.homography.some(
      (coefficient) => typeof coefficient !== 'number' || !Number.isFinite(coefficient),
    )
  ) {
    throw new TypeError('Expected a valid mockup homography.');
  }
  const p = point(source, 'Artwork point');
  if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
    throw new RangeError('Artwork coordinates must lie in the normalized unit square [0, 1]².');
  }
  const [a, b, c, d, e, f, g, h] = definition.homography;
  const denominator = g! * p.x + h! * p.y + 1;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < EPSILON) {
    throw new RangeError('Artwork point maps to a projective pole.');
  }
  const x = (a! * p.x + b! * p.y + c!) / denominator;
  const y = (d! * p.x + e! * p.y + f!) / denominator;
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new RangeError('Mapped point is not finite.');
  return { x, y };
}

export function mapArtworkPoints(
  definition: ValidMockupDefinition,
  points: readonly Point[],
): Point[] {
  if (!Array.isArray(points) || points.length > 10_000) {
    throw new RangeError('Artwork points must be an array of at most 10,000 points.');
  }
  return Array.from(points, (p) => mapArtworkPoint(definition, p));
}

export function isPointInsideMockupMask(definition: ValidMockupDefinition, value: Point): boolean {
  const p = point(value, 'Mask query point');
  if (definition.mask === undefined) return true;
  const polygon = definition.mask;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!;
    const b = polygon[i]!;
    if (onSegment(a, b, p)) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
