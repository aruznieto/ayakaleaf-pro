import { useEffect, useState } from 'react'
import { getJSON } from '@/infrastructure/fetch-json'
import useInstanceFeatures from '@modules/instance-features/frontend/js/use-instance-features'

// Share the permission request across chat and compile-log components.
let access: Promise<boolean> | undefined

export default function useAiAccess() {
  const { ai } = useInstanceFeatures()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!ai) return
    let active = true
    access ??= getJSON('/workbench/access')
      .then((data: { allowed: boolean }) => data.allowed === true)
      .catch(() => {
        access = undefined
        return false
      })
    access.then(value => {
      if (active) setAllowed(value)
    })
    return () => {
      active = false
    }
  }, [ai])

  return ai && allowed
}
