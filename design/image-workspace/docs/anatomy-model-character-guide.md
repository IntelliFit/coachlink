# Anatomy Model Character Guide

## Source

- Reference image: `../references/model-reference-latest.jpg`
- Role: software exercise illustration model for strength-training/anatomy diagrams.

## Character Concept

An anonymous adult male training model for CoachLink exercise illustrations. The character is designed for reusable movement demonstrations, especially strength-training actions that need visible muscle involvement and joint positioning.

## Core Visual Features

- Adult male, lean athletic build, not oversized or bodybuilder-like.
- Short dark hair.
- Face remains anonymized as a natural faceless male mannequin; do not create a recognizable personal identity, detailed facial features, or a smeared/high-speed blur.
- Use bare feet for persona sheets and annotation-friendly reference sheets; avoid shoes unless the specific action image requires footwear.
- Action-image body treatment combines:
  - semi-transparent white/gray outer body silhouette;
  - visible white/gray skeletal structure;
  - red highlighted primary working muscles;
  - orange highlighted secondary/assisting muscles.
- Persona-sheet body treatment should keep the main standing character views completely free of colored muscle markings. No red, orange, yellow, or other colored anatomical highlights should appear on the standing character views; the full body should stay translucent white/gray with skeleton/joint hints only. Colored muscle highlights are reserved for action-reference panels and future action-specific images.
- Clean studio-white or app-neutral background.
- Minimal gym equipment in black/dark gray when needed.

## Rendering Style

- Semi-realistic 3D medical-fitness illustration.
- Clean product lighting, no dramatic shadows.
- Anatomy should be readable but not graphic or medical-horror.
- Avoid blood, gore, exposed tissue realism, bruising, or injury visuals.
- No text inside generated action images unless explicitly requested.

## Muscle Highlight Rules

- Primary mover: red.
- Secondary/assistant mover: orange.
- Skeleton/joints: translucent white/gray.
- Non-target body tissue: low-opacity gray/white.
- Equipment: black or dark neutral gray.

## Pose Production Rules

- Keep the same body proportions across every action.
- Keep the head and face anonymous across every action.
- Use exact exercise positions rather than generic fitness posing.
- Prioritize joint angle clarity:
  - shoulders, elbows, wrists for upper-body pushes/pulls;
  - hips, knees, ankles for lower-body actions;
  - spine/ribcage/pelvis alignment for compound lifts.
- For action sequences, use 3-step panels:
  1. start position;
  2. eccentric/lowering or transition;
  3. concentric/finish.
- Maintain consistent camera angle within a sequence unless the action needs a second view.

## Prompt Template

```text
Create a clean exercise-instruction image using the CoachLink anonymous anatomy model.
The model is an adult male with a lean athletic build, short dark hair, anonymized softly blurred face,
semi-transparent white/gray body silhouette, visible white skeletal structure,
red primary muscle highlights, and orange secondary muscle highlights.
Render in a semi-realistic 3D medical-fitness style on a clean white studio background.
Show the action: <ACTION_NAME>.
Use precise joint angles and readable equipment placement.
No text, no labels, no watermark, no gore, no exaggerated superhero body.
```

## Generated Persona Sheet Prompt

```text
Create a clean character/persona sheet based on the reference image: an adult male athletic exercise-instruction model used in bench press anatomy diagrams. Preserve the key visual identity: short dark hair, natural faceless male mannequin face style, lean athletic build, semi-transparent white/gray anatomical body treatment, and visible white/gray skeletal structure.

Composition: one polished character sheet on a white studio background, horizontal canvas. Preserve the existing reference layout and distribution: three main standing views on the left, one bench-press action reference on the right, and material/color swatches at the far right. The three standing views must be barefoot and must not include any colored muscle highlights anywhere on the body; remove red chest/pectoralis highlights and orange shoulder/arm highlights, replacing them with the same translucent white/gray anatomy material. The right-side bench-press reference may keep red primary and orange secondary muscle highlights. Do not use shoes unless explicitly requested.

Style: high-end fitness app asset, semi-realistic 3D medical/fitness illustration, clean product-design lighting, precise anatomy-inspired overlays, no gore, no blood, no text labels, no watermark.
```

## Notes For Future Assets

- Use the reference model as a style and identity guide, not as a literal copy of the original diagram.
- The original reference includes Chinese labels and a three-step bench-press panel. New production images should normally omit labels and keep text outside the image in UI.
- When building an exercise library, store each generated asset with an action slug, for example:
  - `outputs/bench-press-sequence-v1.png`
  - `outputs/weighted-pullup-sequence-v1.png`
  - `outputs/dip-sequence-v1.png`
