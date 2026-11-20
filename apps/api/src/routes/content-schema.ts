import { Type } from '@sinclair/typebox';
import { ImageOut } from './admin/media';

const Line = (max: number) => Type.String({ maxLength: max });

export const ContentInput = Type.Object(
  {
    announcement: Line(140),
    hero: Type.Object({ eyebrow: Line(80), title: Type.String({ minLength: 3, maxLength: 120 }), subtitle: Line(280), ctaLabel: Type.String({ minLength: 2, maxLength: 30 }), imageId: Type.Union([Type.String(), Type.Null()]) }, { additionalProperties: false }),
    story: Type.Object({ title: Line(120), paragraphs: Type.Array(Line(800), { maxItems: 4 }), signature: Line(80), imageId: Type.Union([Type.String(), Type.Null()]) }, { additionalProperties: false }),
    promises: Type.Array(Type.Object({ title: Type.String({ minLength: 2, maxLength: 40 }), body: Line(140) }, { additionalProperties: false }), { minItems: 1, maxItems: 4 }),
    seo: Type.Object({ title: Type.String({ minLength: 10, maxLength: 70 }), description: Type.String({ minLength: 50, maxLength: 170 }) }, { additionalProperties: false }),
  },
  { additionalProperties: false },
);

export const ContentOut = Type.Intersect([
  ContentInput,
  Type.Object({ images: Type.Object({ hero: Type.Union([ImageOut, Type.Null()]), story: Type.Union([ImageOut, Type.Null()]) }) }),
]);
