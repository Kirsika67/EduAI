import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-[#f4f6f9] overflow-hidden">
      <header className="bg-[#1c3556] flex items-start justify-between flex-shrink-0 relative z-30">
        <TopNav />
        <Sidebar />
      </header>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
