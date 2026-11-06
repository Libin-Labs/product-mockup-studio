import mockups = require('@lp-labs/product-mockup-studio');

const definition = mockups.createMockupDefinition({
  id: 'case',
  width: 100,
  height: 100,
  placement: [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ],
});
mockups.isPointInsideMockupMask(definition, { x: 0, y: 0 }) satisfies boolean;
