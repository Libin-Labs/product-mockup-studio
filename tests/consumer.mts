import {
  createMockupDefinition,
  mapArtworkPoint,
  type MockupDefinition,
} from '@lp-labs/product-mockup-studio';

const definition: MockupDefinition = {
  id: 'mug',
  width: 100,
  height: 100,
  placement: [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ],
};
mapArtworkPoint(createMockupDefinition(definition), { x: 0.5, y: 0.5 }).x satisfies number;
