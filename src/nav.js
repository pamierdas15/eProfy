import { createContext, useContext } from 'react'
/** Navegación entre pantallas: go('lista', { gid, date }) */
export const NavCtx = createContext({ view: 'hoy', params: {}, go: () => {}, signOut: () => {} })
export const useNav = () => useContext(NavCtx)
