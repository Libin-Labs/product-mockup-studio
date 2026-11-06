# @lp-labs/product-mockup-studio

Describe bounded mockup placement geometry and map normalized artwork coordinates onto a
quadrilateral with a projective homography. This package returns geometry and mask tests only; it
does not render a raster, composite pixels, or pretend to model a 3D object.

## Install and quickstart

```sh
npm install @lp-labs/product-mockup-studio
```

```js
import {
  createMockupDefinition,
  mapArtworkPoint,
  isPointInsideMockupMask,
} from '@lp-labs/product-mockup-studio';

const shirt = createMockupDefinition({
  id: 'front-panel',
  width: 800,
  height: 1_000,
  placement: [
    { x: 180, y: 120 },
    { x: 620, y: 140 },
    { x: 590, y: 820 },
    { x: 210, y: 820 },
  ],
  mask: [
    { x: 0, y: 0 },
    { x: 800, y: 0 },
    { x: 800, y: 1_000 },
    { x: 0, y: 1_000 },
  ],
});
const destination = mapArtworkPoint(shirt, { x: 0.5, y: 0.5 });
console.log(destination, isPointInsideMockupMask(shirt, destination));
```

## API and types

- `MockupDefinition`: safe `id`, integer canvas `width` and `height` (1..1,000,000), four ordered
  `placement` points, and optional simple polygon `mask`.
- Placement corner order is top-left, top-right, bottom-right, bottom-left in perimeter order.
  Corners must be finite, in-canvas, strictly convex and nondegenerate.
- `createMockupDefinition(definition)` returns a copied `ValidMockupDefinition` with the solved
  nine-number homography (last coefficient normalized to 1).
- `mapArtworkPoint(definition, point)` maps a normalized artwork coordinate in `[0,1]²` to canvas
  coordinates; an unstable projective pole is rejected.
- `mapArtworkPoints(definition, points)` maps a bounded batch of at most 10,000 points.
- `isPointInsideMockupMask(definition, point)` returns `true` for boundary points, performs a
  polygon point-inclusion test, and returns `true` for any finite point when no mask is supplied.
- `Point`, `MockupDefinition`, and `ValidMockupDefinition` are exported types.

## Customization, errors, and limits

Supply a reusable placement quadrilateral and an optional simple canvas-coordinate mask. The
homography maps normalized flat artwork coordinates; use your own image sampler/renderer for
perspective pixels, alpha masks, blend modes, lighting, and physical surface simulation. A mask is
an inclusion polygon definition and is not automatically applied to mapped output.

Malformed records or non-finite points throw `TypeError`; invalid dimensions, out-of-bounds points,
degenerate/self-intersecting polygons, and invalid normalized input throw `RangeError`. Masks allow
3..64 vertices; point batches allow at most 10,000 points. The transform solve is fixed-size and
constant time; mask validation is O(v²), and point mapping is O(p) for p points.

## Modules and development

Independent ESM and CommonJS builds with declarations; no runtime or peer dependencies.
CommonJS: `const { createMockupDefinition, mapArtworkPoint } = require('@lp-labs/product-mockup-studio')`.
TypeScript `^5.9.3` and Prettier `^3.6.2` are development-only. Run `npm run build`,
`npm run typecheck`, `npm test`, `npm run format`, and `npm run format:check`.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
