import { Billboard, Text } from '@react-three/drei'

type Props = {
  position: [number, number, number]
  text: string
}

// Billboard rotates its children to always face the camera, however the
// scene gets orbited/panned — a plain mesh with flat Text on it would go
// edge-on and disappear the moment the camera turns away from whatever
// angle it was authored at. Text itself is real 3D geometry (SDF glyphs),
// not a DOM overlay, so — unlike the Html labels this replaces — it's
// properly depth-tested against the rest of the scene: a label behind a
// nearer mesh actually gets occluded instead of floating on top of
// everything regardless of what's in front of it.
export default function NodeLabel({ position, text }: Props) {
  return (
    <Billboard position={position}>
      <Text
        fontSize={0.22}
        color="#1e1b4b"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.012}
        outlineColor="#ffffff"
      >
        {text}
      </Text>
    </Billboard>
  )
}
