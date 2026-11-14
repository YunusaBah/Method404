import { cropGlyphs } from './icons/crops'

export function CropGlyph({ crop, size = 48 }) {
  const Glyph = cropGlyphs[crop]
  return <Glyph size={size} />
}
