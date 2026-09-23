/**
 * Registers the AI assistant rail tab and its settings provider through
 * overleafModuleImports.railEntries.
 */
import './workbench.css'
import MaterialIcon from '@/shared/components/material-icon'
import { WorkbenchSettingsProvider } from './context/workbench-settings-context'
import WorkbenchPanel from './components/workbench-panel'

function WorkbenchRailPanel() {
  return (
    <WorkbenchSettingsProvider>
      <WorkbenchPanel />
    </WorkbenchSettingsProvider>
  )
}

/**
 * Render the filled icon directly because auto_awesome has no unfilled glyph.
 */
function WorkbenchRailIcon({ title }: { open: boolean; title: string }) {
  return (
    <MaterialIcon
      type="auto_awesome"
      className="ide-rail-tab-link-icon"
      accessibilityLabel={title}
    />
  )
}

const workbenchRailEntry = {
  key: 'workbench',
  icon: WorkbenchRailIcon,
  title: 'AI assistant',
  component: <WorkbenchRailPanel />,
}

export default workbenchRailEntry
