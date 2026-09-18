import { useRef, useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const searchRef = useRef(null)

  /* Tela de login é a principal enquanto não houver sessão autenticada */
  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <Dashboard
      user={user}
      searchRef={searchRef}
      onLogout={() => setUser(null)}
    />
  )
}

