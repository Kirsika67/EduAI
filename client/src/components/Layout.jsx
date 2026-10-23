import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-[#F7F4EE] overflow-hidden">
      <header className="bg-[#1c3556] flex flex-col md:flex-row md:items-start md:justify-between flex-shrink-0 relative z-30">
        <div className="hidden md:block order-2 md:order-1 flex-1 min-w-0"><TopNav /></div>
        <div className="order-1 md:order-2 self-end md:self-auto"><Sidebar /></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
