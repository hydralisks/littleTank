import type { StatusSemantic } from './statusIconPresentation'

interface StatusSemanticFrameProps {
  semantic: StatusSemantic
}

export function StatusSemanticFrame({ semantic }: StatusSemanticFrameProps) {
  return (
    <span
      className={`status-square__frame status-square__frame--${semantic}`}
      data-status-semantic={semantic}
      aria-hidden="true"
    />
  )
}
