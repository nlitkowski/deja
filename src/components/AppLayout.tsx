import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { ui } from '../i18n/ui';
import { useAppStore } from '../state/appStore';
import { Icon } from './Icon';
import { NavTree, type NavTreeProps } from './NavTree';

const OpenMenuContext = createContext<() => void>(() => {});

/** ☰: opens the drawer on small screens; on wide ones it shows again a sidebar that was collapsed. */
export function MenuButton() {
  const openMenu = useContext(OpenMenuContext);
  return (
    <button className="icon-button menu-button" onClick={openMenu} aria-label={ui.openMenu} aria-haspopup="dialog">
      <Icon name="menu" />
    </button>
  );
}

/** Navigation tree as a sidebar on wide screens and as a drawer behind <MenuButton> on small ones. */
const WIDE = '(min-width: 960px)';

export function AppLayout({ children, ...nav }: NavTreeProps & { children: ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const collapsed = useAppStore((s) => s.settings.navCollapsed);
  const updateSettings = useAppStore((s) => s.updateSettings);
  // The button that was clicked disappears when the sidebar toggles, so focus moves to its counterpart.
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    layout.current?.querySelector<HTMLElement>(collapsed ? '.menu-button' : '.collapse-button')?.focus();
  }, [collapsed]);

  const setCollapsed = (navCollapsed: boolean) => {
    moveFocus.current = true;
    updateSettings({ navCollapsed });
  };
  const openMenu = () => (window.matchMedia(WIDE).matches ? setCollapsed(false) : drawer.current?.showModal());

  useEffect(() => {
    sidebar.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [nav.currentSheetKey]);

  const closeDrawer = () => drawer.current?.open && drawer.current.close();

  // Every navigation from the tree closes the drawer first.
  const { onOpenSheet, onPractice, onJump } = nav;
  const openSheet = (key: string) => {
    closeDrawer();
    onOpenSheet(key);
  };
  const practice = (unitKey: string) => {
    closeDrawer();
    onPractice(unitKey);
  };
  const jump = (index: number) => {
    closeDrawer();
    onJump?.(index);
  };

  const tree = (
    <NavTree
      currentSheetKey={nav.currentSheetKey}
      activeSection={nav.activeSection}
      onOpenSheet={openSheet}
      onPractice={practice}
      onJump={onJump ? jump : undefined}
    />
  );

  return (
    <OpenMenuContext.Provider value={openMenu}>
      <div className={collapsed ? 'layout nav-collapsed' : 'layout'} ref={layout}>
        <aside className="layout-sidebar" ref={sidebar}>
          <div className="sidebar-header">
            <p className="sidebar-heading">{ui.treeHeading}</p>
            <button className="icon-button collapse-button" onClick={() => setCollapsed(true)} aria-label={ui.collapseTree} title={ui.collapseTree}>
              <Icon name="collapse" />
            </button>
          </div>
          {tree}
        </aside>

        <dialog
          ref={drawer}
          className="tree-drawer"
          aria-label={ui.treeLabel}
          // A click on the dialog element itself is a click on the backdrop.
          onClick={(e) => e.target === e.currentTarget && closeDrawer()}
        >
          <div className="drawer-header">
            <p className="sidebar-heading">{ui.treeHeading}</p>
            <button className="icon-button" onClick={closeDrawer} aria-label={ui.closeMenu}>
              <Icon name="close" />
            </button>
          </div>
          {tree}
        </dialog>

        <main className="layout-main">{children}</main>
      </div>
    </OpenMenuContext.Provider>
  );
}
