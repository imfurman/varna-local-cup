# Finale artwork

## Overview

Five cartoon portraits and one race recap cover, generated with the built-in `image_gen` tool (no CLI/API fallback).

## Why / Goals

Make the five real riders recognizable in the replay and personal medals without detailed photorealistic likeness.

## Behavior

Portraits appear in the podium, rider list, map markers, analysis and downloadable medal. The cover replaces the invitation in social metadata when the event is finished.

## Data & Files

All project assets are saved in the repository:

- `public/avatars/ilya.png` — leftmost rider, black helmet, slim long face, black top, sky blue circle.
- `public/avatars/andrii.png` — second rider, bald smiling man, dark jacket and gray hood, mint circle.
- `public/avatars/zhenya.png` — centre rider, long side-swept brown hair, olive jacket over black top, lavender circle.
- `public/avatars/nikita.png` — fourth rider, white helmet, small moustache, black cycling kit, yellow circle.
- `public/avatars/ruslan.png` — rightmost foreground rider, dark tousled hair, round glasses, full beard, blue jacket, orange/coral circle.
- `public/og-finale.png` — landscape recap cover.

Reference: user-provided group photo, left to right Ilya, Andrii, Zhenya, Nikita, Ruslan. The original photo is not included in the site.

## Interfaces (CLI/API)

Five separate built-in generation calls with the group photo as the reference, plus one new illustration call for the cover.

Final portrait prompt template; each call substituted the matching person and colour described above:

> Use case: stylized-concept. Reference image: group photo, use ONLY the [specific person description]. Create ONE square 1024x1024 friendly cartoon rider avatar, head and shoulders centered and large inside a circular [color] background that fills the square. Consistent premium playful cycling game character style: bold clean dark outlines, flat vibrant colors, simple expressive face, lightly exaggerated features, very little detail, subtle cel shading, not photorealistic or 3D. Preserve broad recognizable features of this specific person and outfit described, do not combine with other people. No text, numbers, medal, logos, props or other people. Portrait must fit comfortably inside central 85% safe circle for round cropping.

Final cover prompt:

> Use case: ads-marketing. Asset type: landscape social sharing cover for a finished friendly cycling race website. Create a polished bold playful flat illustration poster, 1536x1024 landscape. Deep forest green background, warm cream giant condensed sans-serif lettering on left, vivid golden yellow, coral red, sky blue, mint and lavender accents. Exact text only: "VARNA" then "LOCAL CUP" then a small label "RACE REPLAY" then "13.09.2026". On the right a large beautifully illustrated gold cycling medal with a black and white checkered ribbon, a stylized curving road through bright green hills and blue sea, five small colored route dots along road (coral, blue, mint, yellow, lavender), subtle confetti. Crisp editorial composition, fun sporting energy, tactile flat vector-like illustration with dark outlines, no gradients or 3D photorealism. Keep text fully readable at thumbnail size, ample safe margins, no other text, no people, no logos, no invitation or start time. It is a race results archive cover.

## Configuration

Circular crops use CSS. The medal composition uses browser Canvas and these existing portraits. The illustration on the cover is decorative, not a navigational map.

## Usage Examples

`<img src="./avatars/nikita.png" alt="Никита Безь">`.

## Testing

Visual inspection of all generated portraits and the cover; browser inspection of the medal; PNG download inspected at full size. Exact placement, name and rank are rendered by code, not embedded in AI-generated portraits.

## Risks / Migration Notes

Portraits are stylizations. Keep originals available when changing crop or export design. Generated source files remain in the Codex generated-images directory; the site uses only the repository copies above.
