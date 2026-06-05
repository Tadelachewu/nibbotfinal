import React from 'react'

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number | string }

function createIcon() {
  return function Icon(_props: IconProps) {
    return null
  }
}

export const Activity = createIcon()
export const AlertCircle = createIcon()
export const CheckCircle2 = createIcon()
export const ChevronLeft = createIcon()
export const ChevronRight = createIcon()
export const ClipboardCheck = createIcon()
export const ClipboardList = createIcon()
export const Clock = createIcon()
export const Edit2 = createIcon()
export const Eye = createIcon()
export const EyeOff = createIcon()
export const Globe = createIcon()
export const Home = createIcon()
export const LayoutDashboard = createIcon()
export const ListTree = createIcon()
export const Loader2 = createIcon()
export const Plus = createIcon()
export const RefreshCw = createIcon()
export const Search = createIcon()
export const Send = createIcon()
export const Trash2 = createIcon()
export const Users = createIcon()

